import { readFileSync } from "fs";
import { join } from "path";
import JobBoard, { type Job, type Company } from "@/components/JobBoard";

export const metadata = {
  title: "z21 Ventures Portfolio Companies Job Board",
  description: "Open positions across z21 Ventures portfolio companies",
};

function loadData() {
  const root = join(process.cwd(), "data");
  const jobs: Job[] = JSON.parse(readFileSync(join(root, "jobs.json"), "utf-8"));
  const companies: Company[] = JSON.parse(readFileSync(join(root, "companies.json"), "utf-8"));
  return { jobs, companies };
}

export default function Home() {
  const { jobs, companies } = loadData();

  const lastUpdated = jobs.length > 0
    ? new Date(jobs[0].scraped_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  return <JobBoard jobs={jobs} companies={companies} lastUpdated={lastUpdated} />;
}
