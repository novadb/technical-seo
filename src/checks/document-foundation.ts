import type { AuditContext, Check, Finding } from "../types.js";

export const documentFoundationCheck: Check = (ctx: AuditContext): Finding[] => {
  const findings: Finding[] = [];
  const cat = "Document Foundation" as const;

  // Doctype
  const doctypeMatch = /^\s*<!doctype\s+([^>]+)>/i.exec(ctx.rawHtml);
  if (!doctypeMatch) {
    findings.push({
      status: "fail", category: cat, name: "HTML5 Doctype",
      message: "No <!DOCTYPE> element at the start of the document",
      fix: "Place <!DOCTYPE html> as the first line",
      priority: "medium",
    });
  } else {
    const decl = doctypeMatch[1].trim().toLowerCase();
    if (decl === "html") {
      findings.push({
        status: "ok", category: cat, name: "HTML5 Doctype",
        message: "<!DOCTYPE html>", priority: "medium",
      });
    } else {
      findings.push({
        status: "warn", category: cat, name: "HTML5 Doctype",
        message: `Legacy doctype: <!DOCTYPE ${decl}>`,
        fix: "Switch to <!DOCTYPE html> (HTML5)",
        priority: "medium",
      });
    }
  }

  // Meta refresh
  if (ctx.metaRefresh) {
    findings.push({
      status: "fail", category: cat, name: "Meta refresh",
      message: `Meta refresh detected (${ctx.metaRefresh.seconds}s${ctx.metaRefresh.url ? ` → ${ctx.metaRefresh.url}` : ""})`,
      fix: "Replace with a proper 301 redirect at the server level",
      priority: "high",
    });
  } else {
    findings.push({
      status: "ok", category: cat, name: "Meta refresh",
      message: "Not present",
      priority: "high",
    });
  }

  return findings;
};
