import { createFileRoute } from "@tanstack/react-router";
import { LearningApp } from "@/components/LearningApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cognita — AI Tutor That Adapts to Your Knowledge State" },
      {
        name: "description",
        content:
          "Cognita maps any topic into concepts, diagnoses what you know, tracks mastery and misconceptions, then teaches only what you're missing.",
      },
      { property: "og:title", content: "Cognita — AI Tutor That Adapts to Your Knowledge State" },
      {
        property: "og:description",
        content: "Adaptive lessons, diagnostics and live mastery tracking for any topic you want to learn.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <LearningApp />;
}
