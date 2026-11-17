import { ContaboS3Storage } from "@/lib/storage/contabo-s3-storage";
import { getS3Config } from "@/lib/storage/config";

export async function renderPdfFromHtml(html: string): Promise<Uint8Array> {
  const { default: chromium } = await import("@sparticuz/chromium");
  const puppeteer = await import("puppeteer-core");
  const executablePath = process.env.PDF_CHROMIUM_EXECUTABLE_PATH?.trim() || await chromium.executablePath();

  const browser = await puppeteer.launch({ args: chromium.args, executablePath, headless: true });
  try {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      // Contracts are self-contained. Do not let a legacy snapshot access the
      // network or local files while a private PDF is rendered.
      if (/^(data:|about:)/.test(request.url())) void request.continue();
      else void request.abort();
    });
    await page.setContent(html, { waitUntil: "networkidle0" });
    return await page.pdf({
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: '<div style="font:8px Arial;width:100%;text-align:center;color:#666">HamloProd · <span class="pageNumber"></span> / <span class="totalPages"></span></div>', 
      format: "A4",
      margin: { top: "20mm", right: "14mm", bottom: "20mm", left: "14mm" },
    });
  } finally {
    await browser.close();
  }
}

export async function createStoredContractPdf(orderId: string, html: string, version: string) {
  let pdfBuffer: Uint8Array;
  try {
    pdfBuffer = await renderPdfFromHtml(html);
  } catch (error) {
    console.error("[contracts] PDF rendering failed", {
      orderId,
      error: error instanceof Error ? error.name : "unknown",
    });
    throw new Error("PDF_RENDER_FAILED");
  }

  const storage = new ContaboS3Storage(getS3Config());
  const key = `contracts/${orderId}/contract-${version}-${Date.now()}.pdf`;

  try {
    await storage.putObject({
      visibility: "private",
      key,
      body: pdfBuffer,
      contentType: "application/pdf",
      contentLength: pdfBuffer.byteLength,
    });
  } catch (error) {
    console.error("[contracts] PDF upload failed", {
      orderId,
      error: error instanceof Error ? error.name : "unknown",
    });
    throw new Error("PDF_UPLOAD_FAILED");
  }

  try {
    const signed = await storage.createSignedDownloadUrl(
      { visibility: "private", key },
      { expiresInSeconds: 900, downloadName: `HamloProd-${orderId}.pdf` },
    );
    return { key, downloadUrl: signed.url };
  } catch (error) {
    console.error("[contracts] PDF URL signing failed", {
      orderId,
      error: error instanceof Error ? error.name : "unknown",
    });
    throw new Error("PDF_SIGN_URL_FAILED");
  }
}

export async function getStoredContractPdfUrl(key: string, orderId: string) {
  const storage = new ContaboS3Storage(getS3Config());
  const signed = await storage.createSignedDownloadUrl(
    { visibility: "private", key },
    { expiresInSeconds: 900, downloadName: `HamloProd-${orderId}.pdf` },
  );
  return signed.url;
}
