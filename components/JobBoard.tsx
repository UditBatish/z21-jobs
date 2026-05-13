"use client";

import { useState, useMemo } from "react";
import Image from "next/image";

export interface Job {
  id: string;
  company: string;
  title: string;
  department: string;
  location: string;
  type: string;
  salary: string;
  url: string;
  posted_at: string;
  scraped_at: string;
}

export interface Company {
  name: string;
  url: string;
  type: string;
  website: string;
  description: string;
  greenhouse_slug?: string;
}

// ── Company badge colors ──────────────────────────────────────────────────────

const COMPANY_COLORS: Record<string, string> = {
  "Origin":        "bg-emerald-100 text-emerald-800",
  "Lighthouz AI":  "bg-violet-100  text-violet-800",
  "Greenjets":     "bg-sky-100     text-sky-800",
  "RISA Labs":     "bg-orange-100  text-orange-800",
  "Zime":          "bg-blue-100    text-blue-800",
  "Devicethread":  "bg-teal-100    text-teal-800",
  "Conifer":       "bg-lime-100    text-lime-800",
  "Refold":        "bg-rose-100    text-rose-800",
};
const DEFAULT_COLOR = "bg-gray-100 text-gray-700";
const companyColor = (name: string) => COMPANY_COLORS[name] ?? DEFAULT_COLOR;

// ── Location normalisation ────────────────────────────────────────────────────

const INDIA_HINTS = ["india", "bangalore", "bengaluru", "delhi", "dl, in", "gurgaon", "hyderabad", "mumbai", "pune", "chennai", "kolkata"];
const US_HINTS    = ["united states", "usa", ", us", "california", "new york", "san francisco", "palo alto", "boston", "seattle", "chicago", "los angeles", "nyc", "austin"];

type Region = "India" | "United States" | "Remote" | "Rest of World";

function normalizeRegion(location: string): Region | null {
  if (!location) return null;
  const l = location.toLowerCase();
  // Remote checked first so "India, Remote" → Remote
  if (l.includes("remote")) return "Remote";
  if (INDIA_HINTS.some((h) => l.includes(h))) return "India";
  if (US_HINTS.some((h) => l.includes(h)))    return "United States";
  return "Rest of World";
}

// ── Function inference ────────────────────────────────────────────────────────

type Fn = "Engineering" | "Product" | "Sales & Success" | "Marketing" | "Operations" | "Design" | "Other";

function inferFunction(job: Job): Fn {
  const t = `${job.title} ${job.department}`.toLowerCase();
  if (/engineer|developer|software|technical|ai\b|ml\b|data\b|platform|robotics|embedded|hardware|devops|qa\b|sre\b|backend|frontend|full.stack|fullstack|cloud|systems|infrastructure|coding|robot|perception|computer vision/.test(t)) return "Engineering";
  if (/product manager|product owner|\bpm\b|\bpmo\b|roadmap/.test(t)) return "Product";
  if (/sales|business development|\bgtm\b|go.to.market|revenue|account|customer success|\bcs\b|customer strat/.test(t)) return "Sales & Success";
  if (/marketing|\bpmm\b|demand gen|brand|content|communications|growth/.test(t)) return "Marketing";
  if (/operations|admin|office|facilities|logistics|supply|recruit|talent|people|\bhr\b|finance|legal|compliance|founder|sourcing|dispatch/.test(t)) return "Operations";
  if (/design|\bux\b|\bui\b|user experience|user interface|creative/.test(t)) return "Design";
  return "Other";
}

const FUNCTIONS: Fn[] = ["Engineering", "Product", "Sales & Success", "Marketing", "Operations", "Design", "Other"];
const REGIONS: Region[] = ["India", "United States", "Remote", "Rest of World"];

// ── Icons ─────────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 0z" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  );
}

// ── Dropdown select ───────────────────────────────────────────────────────────

function FilterSelect<T extends string>({
  placeholder,
  value,
  options,
  onChange,
}: {
  placeholder: string;
  value: T | "";
  options: { label: string; value: T }[];
  onChange: (v: T | "") => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T | "")}
        className="appearance-none w-full pl-3 pr-8 py-2.5 text-sm bg-white border border-gray-200 rounded-lg shadow-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 cursor-pointer"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <svg className="w-3.5 h-3.5 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
      </svg>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function JobBoard({
  jobs,
  companies,
  lastUpdated,
}: {
  jobs: Job[];
  companies: Company[];
  lastUpdated: string;
}) {
  const [search, setSearch]             = useState("");
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [selectedRegion, setSelectedRegion]   = useState<Region | "">("");
  const [selectedFn, setSelectedFn]           = useState<Fn | "">("");

  const scrapedCompanyNames = useMemo(
    () => Array.from(new Set(jobs.map((j) => j.company))).sort(),
    [jobs],
  );
  const linkOnlyCompanies = useMemo(
    () => companies.filter((c) => c.type === "link"),
    [companies],
  );

  const companyCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const j of jobs) map[j.company] = (map[j.company] ?? 0) + 1;
    return map;
  }, [jobs]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return jobs.filter((j) => {
      if (selectedCompany && j.company !== selectedCompany) return false;
      if (selectedRegion && normalizeRegion(j.location) !== selectedRegion) return false;
      if (selectedFn && inferFunction(j) !== selectedFn) return false;
      if (q && !j.title.toLowerCase().includes(q) && !j.department.toLowerCase().includes(q) && !j.location.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [jobs, search, selectedCompany, selectedRegion, selectedFn]);

  const hasActiveFilter = selectedCompany || selectedRegion || selectedFn || search;

  function clearFilters() {
    setSearch("");
    setSelectedCompany("");
    setSelectedRegion("");
    setSelectedFn("");
  }

  const companyOptions = scrapedCompanyNames.map((name) => ({
    label: `${name} (${companyCounts[name] ?? 0})`,
    value: name,
  }));

  const regionOptions = REGIONS.map((r) => ({ label: r, value: r }));
  const fnOptions     = FUNCTIONS.map((f) => ({ label: f, value: f }));

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header ── */}
      <header className="bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between py-4 gap-4">
            <div className="flex items-center gap-3">
              <Image src="/logo-icon.svg" alt="z21 Ventures" width={44} height={44} priority />
              <div>
                <p className="text-white font-bold text-base leading-tight tracking-tight">z21 ventures</p>
                <p className="text-gray-400 text-xs leading-tight mt-0.5">Portfolio Company Jobs</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 hidden sm:block shrink-0">Updated {lastUpdated}</p>
          </div>
        </div>
      </header>
      <div className="h-0.5 bg-[#DE5126]" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">

        {/* ── Filters row ── */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-5">

          {/* Search */}
          <div className="relative sm:col-span-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2"><SearchIcon /></span>
            <input
              type="text"
              placeholder="Search roles…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-lg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>

          {/* Company */}
          <FilterSelect
            placeholder="All companies"
            value={selectedCompany}
            options={companyOptions}
            onChange={setSelectedCompany}
          />

          {/* Location */}
          <FilterSelect
            placeholder="All locations"
            value={selectedRegion}
            options={regionOptions}
            onChange={setSelectedRegion}
          />

          {/* Function */}
          <FilterSelect
            placeholder="All functions"
            value={selectedFn}
            options={fnOptions}
            onChange={setSelectedFn}
          />
        </div>

        {/* ── Results bar ── */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-gray-400">
            {filtered.length === 1 ? "1 open position" : `${filtered.length} open positions`}
            {selectedCompany ? ` at ${selectedCompany}` : " across all companies"}
          </p>
          {hasActiveFilter && (
            <button
              onClick={clearFilters}
              className="text-xs text-gray-400 hover:text-gray-700 transition-colors underline underline-offset-2"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* ── Job list ── */}
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-sm">
            No positions match your search.
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((job) => (
              <li key={job.id}>
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between gap-4 bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-[#DE5126]/50 hover:shadow-sm transition-all"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${companyColor(job.company)}`}>
                        {job.company}
                      </span>
                      {job.department && (
                        <span className="text-xs text-gray-400">{job.department}</span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-[#DE5126] transition-colors">
                      {job.title}
                    </p>
                    {job.location && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                        <LocationIcon />
                        <span>{job.location}</span>
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 text-xs font-medium text-gray-400 group-hover:text-[#DE5126] transition-colors flex items-center gap-1">
                    Apply <ExternalLinkIcon />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}

        {/* ── Link-only companies ── */}
        {linkOnlyCompanies.length > 0 && (
          <div className="mt-10">
            <h2 className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-3">
              More Portfolio Companies
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {linkOnlyCompanies.map((c) => (
                <a
                  key={c.name}
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-3.5 hover:border-[#DE5126]/50 hover:shadow-sm transition-all"
                >
                  <p className="text-sm font-semibold text-gray-800 group-hover:text-[#DE5126] transition-colors">
                    {c.name}
                  </p>
                  <span className="text-xs text-gray-400 group-hover:text-[#DE5126] flex items-center gap-1 shrink-0 transition-colors">
                    View jobs <ExternalLinkIcon />
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-10">
          Listings refreshed every week · Applications handled directly by each company
        </p>
      </div>
    </div>
  );
}
