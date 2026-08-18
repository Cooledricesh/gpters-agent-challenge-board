#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const JOB_ID = "137c5acbdbbe";
const EXPECTED_RUN_AT = Date.parse("2026-08-08T02:40:00+09:00");
const EARLIEST_ACCEPTED_RUN = Date.parse("2026-08-08T02:39:00+09:00");
const LATEST_ACCEPTED_RUN = Date.parse("2026-08-08T02:55:00+09:00");
const EARLIEST_CUTOVER_CHECK = Date.parse("2026-08-08T02:50:00+09:00");
const LATEST_CUTOVER_CHECK = Date.parse("2026-08-08T03:20:00+09:00");
const MAX_ARTIFACT_AGE_MS = 30 * 60 * 1000;
const REQUIRED_PHRASE = "CUTOVER MAY PROCEED AT 03:00 KST";

function fail(reason) {
  console.error(JSON.stringify({ ok: false, gate: "fresh-preflight", reason }));
  process.exit(1);
}

function parseNow(argv) {
  const index = argv.indexOf("--now");
  if (index === -1) return Date.now();
  const value = argv[index + 1];
  const parsed = Date.parse(value);
  if (!value || !Number.isFinite(parsed)) fail("invalid --now value");
  return parsed;
}

const now = parseNow(process.argv.slice(2));
if (now < EARLIEST_CUTOVER_CHECK || now > LATEST_CUTOVER_CHECK) {
  fail("gate checked outside the approved 02:50-03:20 KST window");
}

const hermesHome = process.env.HERMES_HOME || path.join(os.homedir(), ".hermes");
const jobsPath = path.join(hermesHome, "cron", "jobs.json");
let jobsDocument;
try {
  jobsDocument = JSON.parse(fs.readFileSync(jobsPath, "utf8"));
} catch (error) {
  fail(`cannot read cron jobs state: ${error.message}`);
}

const jobs = Array.isArray(jobsDocument) ? jobsDocument : jobsDocument.jobs;
if (!Array.isArray(jobs)) fail("cron jobs state has no jobs array");
const job = jobs.find((candidate) => (candidate.id || candidate.job_id) === JOB_ID);
if (!job) fail("preflight job missing from cron state");
if (job.last_status !== "ok") fail(`preflight last_status is ${String(job.last_status)}`);

const lastRunAt = Date.parse(job.last_run_at || "");
if (!Number.isFinite(lastRunAt)) fail("preflight last_run_at is missing or invalid");
if (lastRunAt < EARLIEST_ACCEPTED_RUN || lastRunAt > LATEST_ACCEPTED_RUN) {
  fail("preflight last_run_at is not the approved 2026-08-08 02:40 execution");
}
if (Math.abs(lastRunAt - EXPECTED_RUN_AT) > 15 * 60 * 1000) {
  fail("preflight execution is outside the 15-minute schedule tolerance");
}
if (job.repeat?.completed !== 1) {
  fail(`preflight one-shot completed count is ${String(job.repeat?.completed)}`);
}

const outputDir = path.join(hermesHome, "cron", "output", JOB_ID);
let artifacts;
try {
  artifacts = fs.readdirSync(outputDir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => {
      const artifactPath = path.join(outputDir, name);
      return { artifactPath, stat: fs.statSync(artifactPath) };
    })
    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
} catch (error) {
  fail(`cannot read preflight output directory: ${error.message}`);
}
if (!artifacts.length) fail("preflight output artifact is missing");

const latest = artifacts[0];
if (latest.stat.mtimeMs < lastRunAt - 60_000) {
  fail("latest artifact predates the recorded preflight execution");
}
if (now - latest.stat.mtimeMs < 0 || now - latest.stat.mtimeMs > MAX_ARTIFACT_AGE_MS) {
  fail("latest preflight artifact is not fresh within 30 minutes");
}

let artifact;
try {
  artifact = fs.readFileSync(latest.artifactPath, "utf8");
} catch (error) {
  fail(`cannot read latest preflight artifact: ${error.message}`);
}

const jobIdMatch = artifact.match(/^\*\*Job ID:\*\*\s*([0-9a-f]+)\s*$/m);
if (jobIdMatch?.[1] !== JOB_ID) fail("artifact job ID does not match preflight job");

const runTimeMatch = artifact.match(/^\*\*Run Time:\*\*\s*(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s*$/m);
if (!runTimeMatch) fail("artifact Run Time header is missing");
const artifactRunAt = Date.parse(`${runTimeMatch[1].replace(" ", "T")}+09:00`);
if (!Number.isFinite(artifactRunAt) || Math.abs(artifactRunAt - lastRunAt) > 120_000) {
  fail("artifact Run Time does not belong to the recorded preflight execution");
}

const responseMarker = "## Response";
const responseIndex = artifact.lastIndexOf(responseMarker);
if (responseIndex === -1) fail("artifact has no Response section");
const response = artifact.slice(responseIndex + responseMarker.length).trim();
const firstResponseLine = response.split(/\r?\n/).find((line) => line.trim())?.trim();
if (firstResponseLine !== "READY") {
  fail(`preflight response first line is ${JSON.stringify(firstResponseLine)}`);
}
if (!response.includes(REQUIRED_PHRASE)) fail("preflight approval phrase is missing");

console.log(JSON.stringify({
  ok: true,
  gate: "fresh-preflight",
  job_id: JOB_ID,
  last_run_at: job.last_run_at,
  artifact: latest.artifactPath,
  artifact_run_time: runTimeMatch[1],
  age_seconds: Math.round((now - latest.stat.mtimeMs) / 1000),
}));
