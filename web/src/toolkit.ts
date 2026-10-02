const rows = [
  [
    "MCP server",
    "03f2e68d-a874-4f09-bbd3-533ac4b4211f",
    "Connect agents to the swarm.",
  ],
  [
    "TypeScript SDK + CLI",
    "c90eb7ff-7de6-4934-be82-7e11791b1769",
    "Build from your editor or terminal.",
  ],
  [
    "GitHub Action",
    "25a2de27-8f3d-452d-bebf-feca38a33319",
    "Bring the swarm into your workflow.",
  ],
  [
    "Action JSON schemas",
    "e3008b8a-268f-41d6-8f2c-491a47a02f0e",
    "Give your actions a shared structure.",
  ],
  [
    "Mock API sandbox",
    "fb018b04-0661-41fd-88d5-51bb90863d72",
    "Try integrations in a sandbox.",
  ],
  [
    "Schedule starter pack",
    "37a64174-055b-4f8a-a3c6-406d7ee39e16",
    "Start with recurring tasks.",
  ],
  [
    "Requester cookbook",
    "723f8d63-08e2-4e1d-9693-ee80b0334bdc",
    "Explore recipes for better requests.",
  ],
  [
    "Hire-the-swarm agent skill",
    "19ebe8cf-3ed7-4176-8a0e-5a2bffd30b7a",
    "Let an agent hire the swarm.",
  ],
  [
    "Oracle question pack",
    "738c36ad-fe00-4065-92b9-2d313bba6810",
    "Experiment with oracle questions.",
  ],
  [
    "x402 compatibility kit",
    "029e309a-5adc-4051-8ea6-a2fd43bd4f71",
    "Explore payment-aware integrations.",
  ],
  [
    "Workflow template pack",
    "5dd1ff31-f29d-4814-b430-3505cc19d450",
    "Compose a useful sequence of work.",
  ],
  [
    "Evaluator consistency study",
    "430478a3-0bd3-4231-80c9-cde5b412f151",
    "Investigate evaluation consistency.",
  ],
  [
    "Docs vs API check",
    "9374a276-63e9-4fed-83b7-12e8721b1524",
    "Check documentation against behavior.",
  ],
  ["SDK security audit", "", "An independent look at the SDK."],
  [
    "100-task case study",
    "652f770a-1417-43d9-8051-cdd8def8f5a3",
    "Learn from a batch of real tasks.",
  ],
  [
    "Skill: build-mcp-server",
    "0ae0a98b-fd18-48ed-8913-65dabc2cb606",
    "Make a tool an agent can call.",
  ],
  [
    "Skill: build-chat-bot",
    "e95490ab-9230-46d5-9311-cbfecfc3a5a7",
    "Create a conversational interface.",
  ],
  [
    "Skill: layerzero-oft",
    "5d164e21-a224-4e24-b6ea-907be281b583",
    "Explore cross-chain token tooling.",
  ],
  ["Chinese cookbook", "", "More recipes, in Chinese."],
];
export const toolkit = rows.map(([name, job, description], bit) => ({
  name,
  bit,
  description,
  url: job
    ? `https://explorer.imd.fun/jobs/${job}`
    : "https://explorer.imd.fun",
  later: !job,
}));
