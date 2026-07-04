#!/usr/bin/env node
/**
 * compass-mcp — an MCP server that grounds an LLM in EU financial, crypto and AI regulation via
 * Compass (https://compass.licentium.ai). It exposes two tools over the public grounding API:
 *   - compass_retrieve : question -> top governing EU provisions, verbatim + article-cited
 *   - compass_verify   : node_id + quote -> is the quote a verbatim span of that provision?
 *
 * Auth: set COMPASS_API_KEY (a ck_live_ key from https://compass.licentium.ai/developers) in this
 * server's environment. Usage is metered against that key's Compass credits.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE = (process.env.COMPASS_API_URL || "https://compass.licentium.ai").replace(/\/+$/, "");
const KEY = process.env.COMPASS_API_KEY;

type CallResult = { data?: any; error?: string };

async function call(path: string, body: unknown): Promise<CallResult> {
  if (!KEY) {
    return {
      error:
        "COMPASS_API_KEY is not set. Create a key at https://compass.licentium.ai/developers and add it to this server's environment.",
    };
  }
  let res: Response;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    const msg = (e as Error).name === "AbortError" ? "request timed out after 30s" : (e as Error).message;
    return { error: `Could not reach Compass at ${BASE}: ${msg}` };
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) return { error: "Compass API key is missing, invalid, or revoked." };
    if (res.status === 402)
      return { error: "Compass credits are exhausted. Top up at https://compass.licentium.ai/developers." };
    if (res.status === 429) return { error: "Rate limited by Compass. Slow down and retry." };
    return { error: (data as { error?: string })?.error || `Compass API error ${res.status}.` };
  }
  return { data };
}

const server = new McpServer({ name: "compass", version: "1.0.0" });

server.tool(
  "compass_retrieve",
  "Ground a claim in EU financial, crypto or AI regulation. Returns the top governing provisions from " +
    "the core EU acts (MiCA, DORA, MiFID II, the AML package, the AI Act, GDPR and more) as VERBATIM " +
    "text with article-level citations and cross-references. Call this BEFORE stating anything about EU " +
    "financial/crypto/AI regulation, and cite the returned provisions by their reference. If nothing is " +
    "returned, do not assert an answer.",
  {
    query: z
      .string()
      .describe("A natural-language regulatory question, e.g. 'Does a custodial wallet need a CASP licence under MiCA?'"),
    top_k: z.number().int().min(1).max(20).optional().describe("How many provisions to return (default 8)."),
  },
  async ({ query, top_k }) => {
    const r = await call("/api/v1/retrieve", { query, top_k: top_k ?? 8 });
    if (r.error) return { content: [{ type: "text", text: r.error }], isError: true };
    const provisions: any[] = r.data?.provisions ?? [];
    if (provisions.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "Compass found no governing provisions for that query in the EU corpus. Do not assert an answer that is not grounded here.",
          },
        ],
      };
    }
    const blocks = provisions
      .map(
        (p, i) =>
          `[${i + 1}] ${p.ref}\nnode_id: ${p.node_id}\n${p.text}` +
          (p.cross_refs?.length ? `\nSee also: ${p.cross_refs.join(", ")}` : ""),
      )
      .join("\n\n");
    const disclaimer = r.data?.disclaimer ? `\n\n${r.data.disclaimer}` : "";
    return {
      content: [
        {
          type: "text",
          text: `Governing EU provisions (verbatim, from primary law). Cite these by reference:\n\n${blocks}${disclaimer}`,
        },
      ],
    };
  },
);

server.tool(
  "compass_verify",
  "Check that a quote is a VERBATIM span of a specific EU provision (identified by the node_id returned by " +
    "compass_retrieve). Use this before presenting a quotation as the words of the law, to guarantee you are " +
    "not misquoting.",
  {
    node_id: z.string().describe("The node_id of the provision, from a compass_retrieve result."),
    quote: z.string().describe("The exact text you intend to attribute to that provision."),
  },
  async ({ node_id, quote }) => {
    const r = await call("/api/v1/verify", { node_id, quote });
    if (r.error) return { content: [{ type: "text", text: r.error }], isError: true };
    const ref = r.data?.ref || node_id;
    const ok = !!r.data?.verified;
    return {
      content: [
        {
          type: "text",
          text: ok
            ? `VERIFIED: the quote is a verbatim span of ${ref}.`
            : `NOT VERIFIED: that quote does not appear verbatim in ${ref}. Do not attribute it as a direct quotation.`,
        },
      ],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr so it never corrupts the stdio JSON-RPC stream.
  console.error(`compass-mcp running (endpoint ${BASE})${KEY ? "" : " (WARNING: COMPASS_API_KEY not set)"}`);
}

main().catch((e) => {
  console.error("compass-mcp fatal:", e);
  process.exit(1);
});
