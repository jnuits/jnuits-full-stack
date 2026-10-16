import {cleanup,render,screen} from "@testing-library/react";
import {afterEach,expect,it} from "vitest";
import {AdminNotificationHealth} from "./admin-notification-health";
afterEach(cleanup);
it("does not claim healthy delivery when no receipt is available",()=>{
 render(<AdminNotificationHealth health={null}/>);expect(screen.getByText(/Job health unavailable/)).toBeVisible();
 expect(screen.queryByText(/Last successful/)).toBeNull();
});
it("shows persisted failure and backlog separately from the last successful job",()=>{
 render(<AdminNotificationHealth health={{state:"attention",lastFinishedAt:"2026-10-16T04:00:00Z",lastSuccessfulAt:"2026-10-15T04:00:00Z",backlog:true,operatorAttentionCount:2}}/>);
 expect(screen.getByText(/Operator attention required/)).toBeVisible();expect(screen.getByText(/2 uncertain delivery records/)).toBeVisible();
 expect(screen.getByText(/Pending work remains/)).toBeVisible();expect(screen.getByText(/Last successful/)).toBeVisible();
});
