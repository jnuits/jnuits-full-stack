import "server-only";
import { Body, Button, Container, Head, Heading, Html, Preview, Text, render } from "@react-email/components";

function NewsletterConfirmationEmail({ confirmationUrl }: { confirmationUrl: string }) {
  return <Html lang="en"><Head/><Body style={{backgroundColor:"#F5F7FB",fontFamily:"Arial,Helvetica,sans-serif",padding:"24px 12px"}}>
    <Preview>Confirm your JnUITS newsletter subscription</Preview>
    <Container style={{backgroundColor:"#FFFFFF",border:"1px solid #D9E1F2",borderRadius:"16px",padding:"28px",maxWidth:"560px"}}>
      <Heading style={{color:"#111735",fontSize:"24px",lineHeight:"32px"}}>Confirm your newsletter subscription</Heading>
      <Text style={{color:"#5F6B85",fontSize:"16px",lineHeight:"24px"}}>You asked to receive JnUITS news and event updates. Open the page below, then choose Confirm subscription. Opening this email or link alone does not subscribe you.</Text>
      <Button href={confirmationUrl} style={{backgroundColor:"#2F55D4",color:"#FFFFFF",padding:"14px 20px",borderRadius:"8px",fontSize:"16px"}}>Review and confirm subscription</Button>
      <Text style={{color:"#5F6B85",fontSize:"14px",lineHeight:"22px"}}>This link expires in 24 hours. If you did not request it, ignore this message. Newsletter consent is separate from your JnUITS membership or account.</Text>
      <Text style={{color:"#5F6B85",fontSize:"14px",lineHeight:"22px"}}>You can manage preferences or unsubscribe using the link in each newsletter.</Text>
    </Container>
  </Body></Html>;
}
export async function buildNewsletterConfirmationEmail(confirmationUrl: string) {
  const element=<NewsletterConfirmationEmail confirmationUrl={confirmationUrl}/>;
  const [html,text]=await Promise.all([render(element),render(element,{plainText:true})]);
  return {html,text};
}
