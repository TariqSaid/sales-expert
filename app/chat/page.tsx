import { Suspense } from "react";
import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import ChatClient from "./ChatClient";

async function Gate() {
  if (!(await isAuthed())) redirect("/login");
  return <ChatClient />;
}

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <Gate />
    </Suspense>
  );
}