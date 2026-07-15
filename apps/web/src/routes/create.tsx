import { createFileRoute } from "@tanstack/react-router";
import { CreateBotForm } from "@/features/bots/create-bot-form";

export const Route = createFileRoute("/create")({
  component: () => <CreateBotForm />,
});
