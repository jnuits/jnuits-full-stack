import { describe, expect, it } from "vitest";
import { buildSingletonBodyUpdate } from "./singleton-edit-policy";
describe("singleton editor ownership", () => {
  it("keeps unrelated home keys, nested keys and later hero slides", () => {
    const current = { stats: [1], sliderImages: [2], future: true, aboutSection: { title: "Old", future: 3 }, heroSlides: [{ title: "Old", effect: "fade" }, { title: "Second" }] };
    const result = buildSingletonBodyUpdate("home", current, { aboutSection: { title: "New" }, heroSlides: [{ title: "New" }], stats: [] });
    expect(result).toEqual({ ...current, aboutSection: {title: "New", future: 3}, heroSlides: [{title: "New", effect: "fade"}, {title: "Second"}] });
    expect(current.aboutSection.title).toBe("Old");
  });
  it("allows deliberate edited-list clearing without discarding sibling keys", () => {
    expect(buildSingletonBodyUpdate("home", {achievements: {items: [{title:"A"}], future: true}}, {achievements:{items:[]}})).toEqual({achievements:{items:[],future:true}});
  });
  it("keeps unedited item metadata in an edited list", () => {
    expect(buildSingletonBodyUpdate("contact", {socialLinks:[{label:"Old", href:"https://example.com", icon:"custom"}]}, {socialLinks:[{label:"New", href:"https://example.com/new"}]})).toEqual({socialLinks:[{label:"New", href:"https://example.com/new", icon:"custom"}]});
  });
  it("treats About as metadata only", () => {
    expect(buildSingletonBodyUpdate("about", {mission:{text:"Preserve"}}, {mission:{text:"Overwrite"}})).toEqual({mission:{text:"Preserve"}});
  });
  it.each([null, [], "text", 1])("rejects nonobject submitted JSON %j", value => {
    expect(() => buildSingletonBodyUpdate("home", {}, value)).toThrow();
  });
  it("rejects unknown singleton slugs", () => expect(() => buildSingletonBodyUpdate("unknown", {}, {})).toThrow());
});
