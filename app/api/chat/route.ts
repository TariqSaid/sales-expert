import OpenAI from "openai";
import { supabase } from "@/lib/supabase";
import { isAuthed } from "@/lib/auth";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = "gpt-5.4-mini";

const COLUMNS =
  "sku, product_name, category, brand, unit, supplier, purchase_price_mad, landed_cost_mad, wholesale_price_mad, selling_price_mad, min_price_mad, margin_mad, margin_pct, stock_qty, warehouse, price_updated_at, quality_level, notes";

const SYSTEM_PROMPT = `You are the internal sales assistant of a hardware/tools trading company. You help employees with product, cost, price, stock and margin questions.

Rules:
- LANGUAGE: if the user's message contains ANY Arabic letters, you MUST answer in Moroccan Darija written in Arabic letters. Product names, numbers, units and technical terms may stay in French/Latin. Never answer in French or Latin-letter Darija unless the user wrote that way. Otherwise reply in the user's language (French or English).
- For ANY question about a product, cost, price, stock or margin, call search_products first. The database is in French: search with short French product keywords (1-3 words), translating from Darija/Arabic (example: كادنا = cadenas). If nothing is found, retry with a different or shorter keyword.
- NEVER invent or estimate prices, costs, stock or margins, and never use numbers from memory. If a value is null or missing, say "no reliable data" for it.
- NEVER do arithmetic yourself. For any total, profit, margin or quantity question, call calculate_deal with the product sku (from search_products) and the quantity, and report its numbers exactly as returned.
- When you report calculate_deal results, always show for each scenario: unit price, total, total profit and margin %. Never leave out the profit.
- When you give a price, mention the source (internal database) and the price_updated_at date.
- If several products match, list them briefly and ask which one.
- Market prices and sales history are not available yet: say so if asked.
- Minimum prices are internal: show them to the employee, but remind them not to share them with customers.
- For discount or "how low can I go" questions: give the selling price and the minimum price scenarios from calculate_deal. Say clearly that quantity-discount rules are not defined yet, so the minimum price is the floor. Do not invent a discount percentage.
- Do not use markdown: no asterisks, no bold, no headings. Plain text with simple dashes only.
- Keep answers short and practical.`;

const tools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_products",
      description:
        "Search the company product database by name, SKU, supplier reference, category or brand. Returns costs, prices, stock and margin.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Short French keywords, e.g. 'cadenas 50mm'",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calculate_deal",
      description:
        "Exact totals, profit and margin for a quantity of ONE product (by sku), at the selling price, the minimum price, and optionally a custom unit price. Always use this instead of calculating yourself.",
      parameters: {
        type: "object",
        properties: {
          sku: { type: "string", description: "Product sku, e.g. CAPI-026" },
          quantity: { type: "number" },
          custom_unit_price_mad: {
            type: "number",
            description: "Optional unit price to test, in MAD",
          },
        },
        required: ["sku", "quantity"],
      },
    },
  },
];

async function searchProducts(query: string) {
  const terms = query
    .split(/\s+/)
    .map((t) => t.replace(/[,()%*_"'\\]/g, ""))
    .filter(Boolean)
    .slice(0, 6);

  let q = supabase.from("products").select(COLUMNS).limit(8);
  for (const t of terms) {
    q = q.or(
      `product_name.ilike.%${t}%,sku.ilike.%${t}%,supplier_ref.ilike.%${t}%,category.ilike.%${t}%,brand.ilike.%${t}%`
    );
  }
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { count: data.length, products: data };
}

async function calculateDeal(sku: string, quantity: number, custom?: number) {
  const { data, error } = await supabase
    .from("products")
    .select(
      "sku, product_name, landed_cost_mad, selling_price_mad, min_price_mad, price_updated_at"
    )
    .eq("sku", sku)
    .maybeSingle();
  if (error || !data) return { error: "product not found" };
  if (data.landed_cost_mad == null)
    return { error: "no reliable data: landed cost is missing" };

  const cost = Number(data.landed_cost_mad);
  const scenario = (label: string, price: number | null) => {
    if (price == null) return { label, error: "no reliable data" };
    const p = Number(price);
    return {
      label,
      unit_price: p,
      total: +(p * quantity).toFixed(2),
      profit_per_unit: +(p - cost).toFixed(2),
      profit_total: +((p - cost) * quantity).toFixed(2),
      margin_pct: +(((p - cost) / p) * 100).toFixed(1),
    };
  };

  const scenarios = [
    scenario("selling price", data.selling_price_mad),
    scenario("minimum price", data.min_price_mad),
  ];
  if (custom != null) scenarios.push(scenario("custom price", custom));

  return {
    product: data.product_name,
    sku: data.sku,
    quantity,
    landed_cost_unit: cost,
    landed_cost_total: +(cost * quantity).toFixed(2),
    price_updated_at: data.price_updated_at,
    scenarios,
  };
}

export async function POST(req: Request) {
  if (!(await isAuthed())) {
    return Response.json(
      { reply: "Not logged in. Please log in again." },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const history: OpenAI.Chat.ChatCompletionMessageParam[] = (body.messages ?? [])
      .filter((m: any) => m.role === "user" || m.role === "assistant")
      .map((m: any) => ({ role: m.role, content: String(m.content) }));

    const convo: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history,
    ];

    // Force Darija in Arabic letters when the user writes with Arabic letters
    const lastUser = [...history].reverse().find((m) => m.role === "user");
    if (lastUser && /[\u0600-\u06FF]/.test(String(lastUser.content))) {
      convo.push({
        role: "system",
        content:
          "The user wrote in Arabic script. Your final answer MUST be in Moroccan Darija written in Arabic letters, for example: الثمن ديال البيع هو 15.46 درهم. Do not answer in French. Keep product names, numbers and units as they are.",
      });
    }

    for (let i = 0; i < 6; i++) {
      const res = await openai.chat.completions.create({
        model: MODEL,
        messages: convo,
        tools,
      });
      const msg = res.choices[0].message;

      if (!msg.tool_calls?.length) {
        return Response.json({ reply: msg.content ?? "" });
      }

      convo.push(msg);
      for (const tc of msg.tool_calls) {
        if (tc.type !== "function") continue;
        let result;
        try {
          const args = JSON.parse(tc.function.arguments);
          result =
            tc.function.name === "calculate_deal"
              ? await calculateDeal(
                  String(args.sku),
                  Number(args.quantity),
                  args.custom_unit_price_mad != null
                    ? Number(args.custom_unit_price_mad)
                    : undefined
                )
              : await searchProducts(String(args.query ?? ""));
        } catch {
          result = { error: "tool failed" };
        }
        convo.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
    }
    return Response.json({ reply: "Sorry, I could not finish. Try rephrasing." });
  } catch (e: any) {
    return Response.json({ reply: "Error: " + (e?.message ?? "unknown") });
  }
}