#!/usr/bin/env python3
"""Scrapes job listings from portfolio company job pages and writes to data/jobs.json."""

import json
import re
import hashlib
import sys
import xml.etree.ElementTree as ET
from datetime import date, datetime
from html import unescape
from pathlib import Path
from urllib.parse import urljoin

try:
    import requests
except ImportError:
    print("requests not found — run: pip install requests")
    sys.exit(1)

ROOT = Path(__file__).parent.parent
COMPANIES_FILE = ROOT / "data" / "companies.json"
JOBS_FILE = ROOT / "data" / "jobs.json"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
}


def make_id(url: str) -> str:
    return hashlib.md5(url.encode()).hexdigest()[:12]


def today() -> str:
    return date.today().isoformat()


# ── Workable ──────────────────────────────────────────────────────────────────

def scrape_workable(company: dict) -> list[dict]:
    m = re.search(r"apply\.workable\.com/([^/]+)", company["url"])
    if not m:
        raise ValueError(f"Cannot parse Workable subdomain from {company['url']}")
    subdomain = m.group(1)

    resp = requests.get(
        f"https://apply.workable.com/{subdomain}/jobs.md",
        headers=HEADERS, timeout=15,
    )
    resp.raise_for_status()

    jobs = []
    for line in resp.text.splitlines():
        m = re.match(
            r"\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(\S+)\s*\|\s*\[View\]\((.+?)\)",
            line,
        )
        if not m or m.group(1) == "Title":
            continue
        title, dept, location, job_type, salary, posted, link = m.groups()
        apply_url = re.sub(r"/jobs/view/([A-Z0-9]+)\.md$", r"/j/\1/", link)
        jobs.append({
            "id": make_id(apply_url),
            "company": company["name"],
            "title": title.strip(),
            "department": dept.strip(),
            "location": location.strip(),
            "type": "" if job_type.strip() == "—" else job_type.strip(),
            "salary": "" if salary.strip() == "—" else salary.strip(),
            "url": apply_url,
            "posted_at": posted.strip(),
            "scraped_at": today(),
        })
    return jobs


# ── Y Combinator ──────────────────────────────────────────────────────────────

def scrape_yc(company: dict) -> list[dict]:
    resp = requests.get(company["url"], headers=HEADERS, timeout=15)
    resp.raise_for_status()

    m = re.search(r'data-page="({.*?})"(?:\s|>)', resp.text, re.DOTALL)
    if not m:
        raise ValueError("Could not find data-page JSON in YC page")

    data = json.loads(unescape(m.group(1)))
    props = data.get("props", data)
    jobs = []
    for jp in props.get("jobPostings", []):
        job_url = "https://www.ycombinator.com" + jp["url"]
        jobs.append({
            "id": make_id(str(jp["id"])),
            "company": company["name"],
            "title": jp["title"],
            "department": jp.get("prettyRole", ""),
            "location": jp.get("location", ""),
            "type": jp.get("type", ""),
            "salary": jp.get("salaryRange", ""),
            "url": job_url,
            "posted_at": "",
            "scraped_at": today(),
        })
    return jobs


# ── TeamTailor (RSS) ──────────────────────────────────────────────────────────

def scrape_teamtailor(company: dict) -> list[dict]:
    # Derive RSS URL from job board URL
    base = re.match(r"(https?://[^/]+)", company["url"]).group(1)
    resp = requests.get(f"{base}/jobs.rss", headers=HEADERS, timeout=15)
    resp.raise_for_status()

    NS = {"tt": "https://teamtailor.com/locations"}
    root = ET.fromstring(resp.content)
    jobs = []
    for item in root.findall(".//item"):
        title = item.findtext("title", "").strip()
        link = item.findtext("link", "").strip()
        pub_date = item.findtext("pubDate", "").strip()
        dept = item.findtext("tt:department", namespaces=NS, default="").strip()

        # Build location string from tt:location
        city = item.findtext(".//tt:city", namespaces=NS, default="").strip()
        country = item.findtext(".//tt:country", namespaces=NS, default="").strip()
        location = ", ".join(filter(None, [city, country]))

        # Parse date
        posted_at = ""
        if pub_date:
            try:
                posted_at = datetime.strptime(pub_date[:16], "%a, %d %b %Y").date().isoformat()
            except ValueError:
                posted_at = pub_date[:10]

        if title and link:
            jobs.append({
                "id": make_id(link),
                "company": company["name"],
                "title": title,
                "department": dept,
                "location": location,
                "type": "",
                "salary": "",
                "url": link,
                "posted_at": posted_at,
                "scraped_at": today(),
            })
    return jobs


# ── Greenhouse ────────────────────────────────────────────────────────────────

def scrape_greenhouse(company: dict) -> list[dict]:
    slug = company.get("greenhouse_slug")
    if not slug:
        m = re.search(r"boards\.greenhouse\.io/([^/?]+)", company["url"])
        if not m:
            raise ValueError(f"Cannot find Greenhouse slug for {company['name']}")
        slug = m.group(1)

    resp = requests.get(
        f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true",
        headers=HEADERS, timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()

    jobs = []
    for j in data.get("jobs", []):
        dept = ""
        if j.get("departments"):
            dept = j["departments"][0].get("name", "")
        posted_at = j.get("first_published") or j.get("updated_at") or ""
        if posted_at:
            posted_at = posted_at[:10]

        jobs.append({
            "id": make_id(j["absolute_url"]),
            "company": company["name"],
            "title": j["title"],
            "department": dept,
            "location": j.get("location", {}).get("name", ""),
            "type": "",
            "salary": "",
            "url": j["absolute_url"],
            "posted_at": posted_at,
            "scraped_at": today(),
        })
    return jobs


# ── Lever ─────────────────────────────────────────────────────────────────────

def scrape_lever(company: dict) -> list[dict]:
    m = re.search(r"jobs\.lever\.co/([^/?]+)", company["url"])
    if not m:
        raise ValueError(f"Cannot parse Lever slug from {company['url']}")
    slug = m.group(1)

    resp = requests.get(
        f"https://api.lever.co/v0/postings/{slug}?mode=json",
        headers=HEADERS, timeout=15,
    )
    resp.raise_for_status()

    jobs = []
    for p in resp.json():
        jobs.append({
            "id": make_id(p["hostedUrl"]),
            "company": company["name"],
            "title": p["text"],
            "department": p.get("categories", {}).get("department", ""),
            "location": p.get("categories", {}).get("location", ""),
            "type": p.get("categories", {}).get("commitment", ""),
            "salary": "",
            "url": p["hostedUrl"],
            "posted_at": "",
            "scraped_at": today(),
        })
    return jobs


# ── Zime (custom HTML) ────────────────────────────────────────────────────────

def scrape_zime_html(company: dict) -> list[dict]:
    resp = requests.get(company["url"], headers=HEADERS, timeout=15)
    resp.raise_for_status()
    html = resp.text

    jobs = []
    # Each job block: <div class="job-card reveal">...</div>
    cards = re.findall(
        r'<div class="job-card[^"]*">(.*?)</div>\s*</div>\s*</div>\s*(?:</div>)?',
        html, re.DOTALL
    )
    for card in cards:
        title_m = re.search(r'class="job-title[^"]*">([^<]+)<', card)
        if not title_m:
            continue
        title = title_m.group(1).strip()

        spans = re.findall(r'class="job-(?:location|department)[^"]*">([^<]+)<', card)
        location = spans[0].strip() if len(spans) > 0 else ""
        dept = spans[1].strip() if len(spans) > 1 else ""
        job_type = spans[2].strip() if len(spans) > 2 else ""

        jobs.append({
            "id": make_id(company["url"] + title),
            "company": company["name"],
            "title": title,
            "department": dept,
            "location": location,
            "type": job_type,
            "salary": "",
            "url": company["url"],
            "posted_at": "",
            "scraped_at": today(),
        })
    return jobs


# ── Devicethread (custom HTML) ────────────────────────────────────────────────

def scrape_devicethread_html(company: dict) -> list[dict]:
    resp = requests.get(company["url"], headers=HEADERS, timeout=15)
    resp.raise_for_status()
    html = resp.text

    base_url = re.match(r"(https?://[^/]+)", company["url"]).group(1)

    titles = re.findall(r'class="card-title">([^<]+)<', html)
    locations = re.findall(r'class="sales-job-card".*?<button>([^<]+)</button>', html, re.DOTALL)
    links = re.findall(r'href="(careers/[^"]+)"', html)

    jobs = []
    for i, title in enumerate(titles):
        location = locations[i].strip() if i < len(locations) else ""
        rel_link = links[i] if i < len(links) else ""
        job_url = urljoin(base_url + "/", rel_link) if rel_link else company["url"]
        jobs.append({
            "id": make_id(job_url),
            "company": company["name"],
            "title": title.strip(),
            "department": "",
            "location": location,
            "type": "",
            "salary": "",
            "url": job_url,
            "posted_at": "",
            "scraped_at": today(),
        })
    return jobs


# ── Dispatch ──────────────────────────────────────────────────────────────────

SCRAPERS = {
    "workable": scrape_workable,
    "yc": scrape_yc,
    "teamtailor": scrape_teamtailor,
    "greenhouse": scrape_greenhouse,
    "lever": scrape_lever,
    "zime_html": scrape_zime_html,
    "devicethread_html": scrape_devicethread_html,
    # "link" type is intentionally excluded — no scraping
}


def main():
    companies = json.loads(COMPANIES_FILE.read_text())
    all_jobs: list[dict] = []
    seen: set[str] = set()

    for company in companies:
        platform = company.get("type", "")
        scraper = SCRAPERS.get(platform)
        if not scraper:
            if platform != "link":
                print(f"[SKIP] {company['name']} — unknown platform '{platform}'")
            continue

        print(f"[{platform.upper()}] Scraping {company['name']}...")
        try:
            jobs = scraper(company)
            added = 0
            for job in jobs:
                if job["id"] not in seen:
                    seen.add(job["id"])
                    all_jobs.append(job)
                    added += 1
            print(f"  ✓ {added} jobs")
        except Exception as e:
            print(f"  ✗ Error: {e}")

    JOBS_FILE.write_text(json.dumps(all_jobs, indent=2, ensure_ascii=False))
    print(f"\nDone. {len(all_jobs)} total jobs → {JOBS_FILE}")


if __name__ == "__main__":
    main()
