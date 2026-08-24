import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { embedInlineImages } from "./html.js";

const PIXEL_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

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
