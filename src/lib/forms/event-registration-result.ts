export function getEventRegistrationSuccessContent(waitlisted: boolean) {
  return waitlisted
    ? {
        heading: "You are on the waitlist",
        message:
          "A place is not confirmed yet. Check your email for your waitlist code and next steps.",
      }
    : {
        heading: "Registration complete",
        message:
          "Your registration is complete. Check your email for your check-in code.",
      };
}
