import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("next/navigation",()=>({useRouter:()=>({push:vi.fn()}),useSearchParams:()=>new URLSearchParams("view=activity&action=fixture.work")}));
import { AdminActivityWorkspaceClient } from "./admin-activity-workspace-client";
it("server-rendered filters and pagination work before JavaScript hydration",()=>{
 const html=renderToStaticMarkup(<AdminActivityWorkspaceClient items={[]} coverage={{state:"partial",observedSince:null,lastCollectedAt:null,message:"Partial coverage"}} page={1} pageSize={25} totalItems={126} filters={{action:"fixture.work"}}/>);
 render(<div dangerouslySetInnerHTML={{__html:html}}/>);
 const next=new URL(screen.getByRole("link",{name:"Next"}).getAttribute("href")!,"https://jnuits.org.bd");
 expect(next.searchParams.get("page")).toBe("2");expect(next.searchParams.get("action")).toBe("fixture.work");
 const form=screen.getByRole("form",{name:"Activity filter controls"});
 expect(form).toHaveAttribute("method","get");expect(form).toHaveAttribute("action","/admin/audit");
 expect(new FormData(form as HTMLFormElement).get("view")).toBe("activity");
 expect(form.querySelector('[name="from"]')).not.toBeNull();expect(form.querySelector('[name="to"]')).not.toBeNull();
 expect(screen.getByRole("link",{name:"Reset"})).toHaveAttribute("href","/admin/audit?view=activity");
});
