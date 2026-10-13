import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const state=vi.hoisted(()=>({push:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>({push:state.push})}));
vi.mock("@/app/admin/content/actions",()=>({saveContentPage:vi.fn()}));
import { PageSingletonEditor } from "./page-singleton-editor";
const selected={slug:"home",title:"Stored home",status:"published",eyebrow:null,summary:null,body:{heroSlides:[{title:"Hero"}]},updated_at:"2026-01-01T00:00:00Z"};
beforeEach(()=>vi.clearAllMocks());
it("submits the loaded revision and switches pages through a fresh server selection",()=>{
 render(<PageSingletonEditor selected={selected} />);
 const form=screen.getByRole("button",{name:/Save content page/}).closest("form")!;
 expect(new FormData(form).get("expectedUpdatedAt")).toBe(selected.updated_at);
 fireEvent.change(screen.getByLabelText("Page"),{target:{value:"footer"}});
 expect(state.push).toHaveBeenCalledWith("/admin/content/pages?edit=footer");
 expect(new FormData(form).get("slug")).toBe("home");
});
it("loads a new missing singleton using the requested slug without borrowing another body",()=>{
 render(<PageSingletonEditor selected={null} initialSlug="footer" />);
 expect(screen.getByLabelText("Page")).toHaveValue("footer");
 expect(screen.queryByLabelText("Hero title")).not.toBeInTheDocument();
});
