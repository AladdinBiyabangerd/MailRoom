import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyPersonalizedGreeting,
  buildGreetingHtml,
  embedInlineImages,
  resolveGreetingName,
  SALAM_PLACEHOLDER,
} from "./html.js";

const PIXEL_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("applyPersonalizedGreeting", () => {
  it("replaces {{salam}} with bold greeting inside the template", () => {
    const html = `<html><body><td>Header</td><td>${SALAM_PLACEHOLDER} Hörmətli həmkarlar, mətn.</td></body></html>`;
    const result = applyPersonalizedGreeting(html, "Ada", true);
    assert.match(result, /<b style="font-weight:700[^"]*">Salam Ada,<\/b>/);
    assert.ok(result.includes("Hörmətli həmkarlar"));
    assert.ok(!result.includes(SALAM_PLACEHOLDER));
    assert.ok(result.indexOf("Salam Ada") > result.indexOf("Header"));
  });

  it("uses Salam, when name is missing", () => {
    const result = applyPersonalizedGreeting(`Hi ${SALAM_PLACEHOLDER}`, null, true);
    assert.equal(result, `Hi ${buildGreetingHtml(null)}`);
  });

  it("removes placeholder when greeting is disabled", () => {
    const result = applyPersonalizedGreeting(`X ${SALAM_PLACEHOLDER} Y`, "Ada", false);
    assert.equal(result, "X  Y");
  });

  it("leaves html unchanged when placeholder is absent", () => {
    const html = "<p>No token</p>";
    assert.equal(applyPersonalizedGreeting(html, "Ada", true), html);
  });

  it("escapes html in the name", () => {
    const result = applyPersonalizedGreeting(SALAM_PLACEHOLDER, `<img src=x>`, true);
    assert.match(result, /Salam &lt;img src=x&gt;,/);
  });
});

describe("resolveGreetingName", () => {
  it("returns trimmed name", () => {
    assert.equal(resolveGreetingName("  Ada  ", "a@b.com"), "Ada");
  });

  it("returns null for blank", () => {
    assert.equal(resolveGreetingName("  ", "a@b.com"), null);
    assert.equal(resolveGreetingName(null), null);
  });

  it("returns null when name equals email", () => {
    assert.equal(resolveGreetingName("A@B.com", "a@b.com"), null);
  });
});

describe("embedInlineImages", () => {
  it("leaves html without data images unchanged", () => {
    const html = '<p>Hi</p><img src="https://cdn.example/a.png" alt="a" />';
    const result = embedInlineImages(html);
    assert.equal(result.html, html);
    assert.equal(result.images.length, 0);
  });

  it("rewrites data png to cid and keeps bytes", () => {
    const html = `<p>Hi</p><img src="data:image/png;base64,${PIXEL_B64}" alt="logo" />`;
    const result = embedInlineImages(html);
    assert.match(result.html, /src="cid:inline-img-1"/);
    assert.equal(result.images.length, 1);
    assert.equal(result.images[0].contentId, "inline-img-1");
    assert.equal(result.images[0].contentType, "image/png");
    assert.deepEqual(result.images[0].content, Buffer.from(PIXEL_B64, "base64"));
  });

  it("rewrites jpeg and webp subtypes", () => {
    const jpeg = embedInlineImages(`<img src='data:image/jpeg;base64,${PIXEL_B64}' />`);
    assert.equal(jpeg.images[0].contentType, "image/jpeg");
    const webp = embedInlineImages(`<img src="data:image/webp;base64,${PIXEL_B64}" />`);
    assert.equal(webp.images[0].contentType, "image/webp");
  });

  it("embeds multiple images with unique content ids", () => {
    const html = `<img src="data:image/png;base64,${PIXEL_B64}" /><img src="data:image/png;base64,${PIXEL_B64}" />`;
    const result = embedInlineImages(html);
    assert.equal(result.images.length, 2);
    assert.match(result.html, /cid:inline-img-1/);
    assert.match(result.html, /cid:inline-img-2/);
  });

  it("does not rewrite svg data urls", () => {
    const html = '<img src="data:image/svg+xml;base64,PHN2Zy8+" />';
    const result = embedInlineImages(html);
    assert.equal(result.html, html);
    assert.equal(result.images.length, 0);
  });

  it("keeps empty base64 as-is", () => {
    const html = '<img src="data:image/png;base64," />';
    const result = embedInlineImages(html);
    assert.equal(result.html, html);
    assert.equal(result.images.length, 0);
  });
});
