# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> published AI and IT Fest campaign >> mobile homepage keeps four cards and one core BrainChild feature
- Location: e2e\smoke.spec.ts:214:9

# Error details

```
Error: campaign console errors

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "Loading the script 'https://vercel.live/_next-live/feedback/feedback.js' violates the following Content Security Policy directive: \"script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com\". Note that 'script-src-elem' was not explicitly set, so 'script-src' is used as a fallback. The action has been blocked.",
+ ]
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - banner [ref=e2]:
    - generic [ref=e4]:
      - link "Go to Jagannath University IT Society home" [ref=e5] [cursor=pointer]:
        - /url: /
        - generic [ref=e6]:
          - img "Jagannath University IT Society official logo" [ref=e8]
          - generic [ref=e9]:
            - generic [ref=e10]: JnU IT Society
            - generic [ref=e11]: Step Ahead with IT
      - generic [ref=e12]:
        - button "Toggle color theme" [ref=e13] [cursor=pointer]:
          - img [ref=e15]
        - link "Portal" [ref=e17] [cursor=pointer]:
          - /url: /portal/dashboard
        - button "Open navigation menu" [ref=e18] [cursor=pointer]:
          - img [ref=e19]
  - main [ref=e20]:
    - generic [ref=e21]:
      - region "JnU AI & IT Fest 2026" [ref=e22]:
        - generic [ref=e23]:
          - generic [ref=e24]:
            - generic [ref=e25]:
              - paragraph [ref=e26]:
                - img [ref=e27]
                - text: Presented by Jagannath University IT Society
              - heading "JnU AI & IT Fest 2026" [level=1] [ref=e30]
              - paragraph [ref=e31]: Where Ideas Meet Intelligence
              - paragraph [ref=e32]: "Where Ideas Meet Intelligence: JnUITS presents a day of AI, technology, creativity, support, and student innovation at Jagannath University."
              - generic [ref=e33]:
                - generic [ref=e34]:
                  - img [ref=e35]
                  - text: Aug 30, 2026
                - generic [ref=e37]:
                  - img [ref=e38]
                  - text: Jagannath University
              - generic [ref=e41]:
                - link "Explore the Fest" [active] [ref=e42] [cursor=pointer]:
                  - /url: https://itfest.jnuits.org.bd/
                  - text: Explore the Fest
                  - img [ref=e43]
                - link "View JnUITS events" [ref=e47] [cursor=pointer]:
                  - /url: /events
                  - text: View JnUITS events
                  - img [ref=e48]
            - generic [ref=e50]:
              - img "JnU AI & IT Fest 2026 official campaign artwork" [ref=e51]
              - generic [ref=e52]: Official Fest programme
          - region "Fest event showcase" [ref=e53]:
            - generic [ref=e54]:
              - paragraph [ref=e55]: Four ways to take part
              - heading "Fest event showcase" [level=2] [ref=e56]
            - generic [ref=e57]:
              - article "AI & IT Olympiad" [ref=e58]:
                - generic [ref=e59]:
                  - img "AI & IT Olympiad official event artwork" [ref=e60]
                  - generic [ref=e61]: Upcoming
                - generic [ref=e62]:
                  - generic [ref=e63]:
                    - generic [ref=e64]:
                      - img [ref=e65]
                      - text: Solo
                    - generic [ref=e70]: BDT 200
                  - heading "AI & IT Olympiad" [level=3] [ref=e71]
                  - paragraph [ref=e72]: A national-level AI and IT challenge with junior and senior solo segments for school, college, and university participants.
                  - generic [ref=e73]:
                    - generic [ref=e74]:
                      - term [ref=e75]:
                        - img [ref=e76]
                        - text: Event
                      - definition [ref=e78]: Aug 30, 2026
                    - generic [ref=e79]:
                      - term [ref=e80]:
                        - img [ref=e81]
                        - text: Registration closes
                      - definition [ref=e84]: Aug 15, 2026, 11:59 PM
                  - generic [ref=e85]:
                    - link "View details" [ref=e86] [cursor=pointer]:
                      - /url: /events/ai-it-olympiad
                      - text: View details
                      - img [ref=e87]
                    - link "Register now" [ref=e89] [cursor=pointer]:
                      - /url: https://itfest.jnuits.org.bd/events/ai-it-olympiad
                      - text: Register now
                      - img [ref=e90]
              - article "TechUncut" [ref=e94]:
                - generic [ref=e95]:
                  - img "TechUncut official event artwork" [ref=e96]
                  - generic [ref=e97]: Upcoming
                - generic [ref=e98]:
                  - generic [ref=e99]:
                    - generic [ref=e100]:
                      - img [ref=e101]
                      - text: Solo admission
                    - generic [ref=e106]: BDT 200
                  - heading "TechUncut" [level=3] [ref=e107]
                  - paragraph [ref=e108]: The Fest's flagship conference, bringing creators and AI pioneers together for talks on technology, careers, research, and innovation.
                  - generic [ref=e109]:
                    - generic [ref=e110]:
                      - term [ref=e111]:
                        - img [ref=e112]
                        - text: Event
                      - definition [ref=e114]: Aug 30, 2026
                    - generic [ref=e115]:
                      - term [ref=e116]:
                        - img [ref=e117]
                        - text: Registration closes
                      - definition [ref=e120]: Aug 15, 2026, 11:59 PM
                  - generic [ref=e121]:
                    - link "View details" [ref=e122] [cursor=pointer]:
                      - /url: /events/techuncut
                      - text: View details
                      - img [ref=e123]
                    - link "Register now" [ref=e125] [cursor=pointer]:
                      - /url: https://itfest.jnuits.org.bd/events/techuncut
                      - text: Register now
                      - img [ref=e126]
              - article "TechCare Zone" [ref=e130]:
                - generic [ref=e131]:
                  - img "TechCare Zone official event artwork" [ref=e132]
                  - generic [ref=e133]: Upcoming
                - generic [ref=e134]:
                  - generic [ref=e135]:
                    - generic [ref=e136]:
                      - img [ref=e137]
                      - text: Individual service
                    - generic [ref=e142]: Free for Fest participants · BDT 100 visitor token
                  - heading "TechCare Zone" [level=3] [ref=e143]
                  - paragraph [ref=e144]: A festival support booth for software installation and system setup—free for registered participants, with a BDT 100 visitor token.
                  - generic [ref=e145]:
                    - generic [ref=e146]:
                      - term [ref=e147]:
                        - img [ref=e148]
                        - text: Event
                      - definition [ref=e150]: Aug 30, 2026
                    - generic [ref=e151]:
                      - term [ref=e152]:
                        - img [ref=e153]
                        - text: Registration closes
                      - definition [ref=e156]: Aug 15, 2026, 11:59 PM
                  - generic [ref=e157]:
                    - link "View details" [ref=e158] [cursor=pointer]:
                      - /url: /events/techcare-zone
                      - text: View details
                      - img [ref=e159]
                    - link "Register now" [ref=e161] [cursor=pointer]:
                      - /url: https://itfest.jnuits.org.bd/events/techcare-zone
                      - text: Register now
                      - img [ref=e162]
              - article "AI Ad-Venture" [ref=e166]:
                - generic [ref=e167]:
                  - img "AI Ad-Venture official event artwork" [ref=e168]
                  - generic [ref=e169]: Upcoming
                - generic [ref=e170]:
                  - generic [ref=e171]:
                    - generic [ref=e172]:
                      - img [ref=e173]
                      - text: Team of 2-5
                    - generic [ref=e178]: BDT 300 per team
                  - heading "AI Ad-Venture" [level=3] [ref=e179]
                  - paragraph [ref=e180]: A national prompt-to-production challenge where teams of 2-5 create promotional advertisements using generative AI tools.
                  - generic [ref=e181]:
                    - generic [ref=e182]:
                      - term [ref=e183]:
                        - img [ref=e184]
                        - text: Event
                      - definition [ref=e186]: Aug 30, 2026
                    - generic [ref=e187]:
                      - term [ref=e188]:
                        - img [ref=e189]
                        - text: Registration closes
                      - definition [ref=e192]: Aug 15, 2026, 11:59 PM
                  - generic [ref=e193]:
                    - link "View details" [ref=e194] [cursor=pointer]:
                      - /url: /events/ai-ad-venture
                      - text: View details
                      - img [ref=e195]
                    - link "Register now" [ref=e197] [cursor=pointer]:
                      - /url: https://itfest.jnuits.org.bd/events/ai-ad-venture
                      - text: Register now
                      - img [ref=e198]
          - region "BrainChild core event" [ref=e202]:
            - generic [ref=e203]:
              - img "BrainChild Season 2.0 official campaign artwork" [ref=e204]
              - generic [ref=e205]: Core event
            - generic [ref=e206]:
              - paragraph [ref=e207]: National App, Web & AI Project Expo
              - heading "BrainChild Season 2.0" [level=2] [ref=e208]
              - paragraph [ref=e209]: The Fest's core national app, web, and AI project expo for student teams of 2-3, with the top 15 shortlisted for the live exhibition.
              - generic [ref=e210]:
                - generic [ref=e211]:
                  - img [ref=e212]
                  - text: Team of 2-3
                - generic [ref=e217]: BDT 2,000 per team
                - generic [ref=e218]:
                  - img [ref=e219]
                  - text: Deadline Aug 20, 2026, 11:59:59 PM
              - generic [ref=e222]:
                - link "Register for BrainChild" [ref=e223] [cursor=pointer]:
                  - /url: https://brainchild.jnuits.org.bd/register
                  - text: Register for BrainChild
                  - img [ref=e224]
                - link "Track registration" [ref=e228] [cursor=pointer]:
                  - /url: https://brainchild.jnuits.org.bd/track
              - navigation "BrainChild resources" [ref=e229]:
                - link "Explore BrainChild" [ref=e230] [cursor=pointer]:
                  - /url: https://brainchild.jnuits.org.bd/
                  - text: Explore BrainChild
                  - img [ref=e231]
                - link "Read rulebook" [ref=e235] [cursor=pointer]:
                  - /url: https://drive.google.com/file/d/1txSeyWJIOFxNW3XFUmjYZMrkN6uEemFj/view?usp=sharing
                  - text: Read rulebook
                  - img [ref=e236]
          - link "Explore every official Fest event" [ref=e241] [cursor=pointer]:
            - /url: https://itfest.jnuits.org.bd/events
            - text: Explore every official Fest event
            - img [ref=e242]
      - generic [ref=e246]:
        - generic [ref=e247]: Step Ahead with IT
        - heading "Jagannath University IT Society" [level=2] [ref=e248]
        - paragraph [ref=e249]: JnUITS is the official student IT club of Jagannath University — offering workshops, coding competitions, tech talks, and community-driven programs that bridge academic learning with real-world IT skills.
        - generic [ref=e250]:
          - link "Join JnUITS" [ref=e251] [cursor=pointer]:
            - /url: /members/join
          - link "Explore events" [ref=e252] [cursor=pointer]:
            - /url: /events
      - generic "JnUITS activity gallery" [ref=e255]:
        - generic [ref=e256]:
          - generic [ref=e257]:
            - img "Inauguration & Fresher's Reception 2023-2024" [ref=e258]
            - paragraph [ref=e259]: Inauguration & Fresher's Reception 2023-2024
            - link "View Inauguration & Fresher's Reception 2023-2024" [ref=e260] [cursor=pointer]:
              - /url: /gallery/inauguration-and-fresher-s-reception-2023-2024
              - text: View →
          - generic:
            - img
            - paragraph: Mastering the Art of Digital Communications
            - link:
              - /url: /gallery/mastering-the-art-of-digital-communications
              - text: View →
          - generic:
            - img
            - paragraph: "Odoo ERP: The Future of Business Automation"
            - link:
              - /url: /gallery/odoo-erp-the-future-of-business-automation
              - text: View →
          - generic:
            - img
            - paragraph: BrainChild Basic Apps Development Seminar
            - link:
              - /url: /gallery/brainchild-basic-apps-development-seminar
              - text: View →
          - generic:
            - img
            - paragraph: 7th Foundation Day & BrainChild Season 1.0 Prize Giving
            - link:
              - /url: /gallery/7th-foundation-day-and-brainchild-season-1-0-prize-giving
              - text: View →
          - button "Previous slide" [ref=e261] [cursor=pointer]:
            - img [ref=e262]
          - button "Next slide" [ref=e264] [cursor=pointer]:
            - img [ref=e265]
        - tablist "Slider navigation" [ref=e267]:
          - tab "Slide 1 of 5" [selected] [ref=e268] [cursor=pointer]
          - tab "Slide 2 of 5" [ref=e269] [cursor=pointer]
          - tab "Slide 3 of 5" [ref=e270] [cursor=pointer]
          - tab "Slide 4 of 5" [ref=e271] [cursor=pointer]
          - tab "Slide 5 of 5" [ref=e272] [cursor=pointer]
      - region "JnUITS impact statistics" [ref=e273]:
        - generic [ref=e275]:
          - generic [ref=e276]:
            - paragraph [ref=e277]: 300+
            - paragraph [ref=e278]: Active members
          - generic [ref=e279]:
            - paragraph [ref=e280]: 150+
            - paragraph [ref=e281]: Events organized
          - generic [ref=e282]:
            - paragraph [ref=e283]: 10+
            - paragraph [ref=e284]: Years active
          - generic [ref=e285]:
            - paragraph [ref=e286]: 6+
            - paragraph [ref=e287]: Executive terms
          - generic [ref=e288]:
            - paragraph [ref=e289]: 2000+
            - paragraph [ref=e290]: Alumni & community
      - article "ABOUT JNUITS" [ref=e293]:
        - paragraph [ref=e294]: ABOUT JNUITS
        - paragraph [ref=e295]: JnUITS is the official student IT club of Jagannath University, helping students move from academic learning into practical technology work. Through workshops, coding competitions, tech talks, mentoring, and community-driven programs, the society creates a bridge between classroom knowledge and real-world IT skills.
        - link "Learn more about JnUITS →" [ref=e296] [cursor=pointer]:
          - /url: /about
      - generic [ref=e298]:
        - generic [ref=e299]:
          - paragraph [ref=e300]: What we do
          - heading "Programs built for real skills" [level=2] [ref=e301]
        - generic [ref=e302]:
          - article [ref=e303]:
            - img [ref=e305]
            - heading "Workshops & Courses" [level=3] [ref=e307]
            - paragraph [ref=e308]: Hands-on sessions covering programming, web development, cybersecurity, and data science.
          - article [ref=e309]:
            - img [ref=e311]
            - heading "Competitions & Hackathons" [level=3] [ref=e317]
            - paragraph [ref=e318]: Coding contests and IT challenges where students solve real problems and showcase skills nationally.
          - article [ref=e319]:
            - img [ref=e321]
            - heading "Networking & Career Growth" [level=3] [ref=e326]
            - paragraph [ref=e327]: Events connecting students with industry professionals, alumni, and mentors for career guidance.
          - article [ref=e328]:
            - img [ref=e330]
            - heading "Community & Social Impact" [level=3] [ref=e332]
            - paragraph [ref=e333]: Initiatives applying technology to community needs and public-interest projects beyond the campus.
      - generic [ref=e335]:
        - generic [ref=e336]:
          - paragraph [ref=e337]: What's coming up
          - heading "Upcoming events" [level=2] [ref=e338]
        - generic [ref=e339]:
          - article [ref=e340]:
            - paragraph [ref=e341]:
              - img [ref=e342]
              - text: AUG 30
            - heading "AI Ad-Venture" [level=3] [ref=e344]
            - paragraph [ref=e345]: A national prompt-to-production challenge where teams of 2-5 create promotional advertisements using generative AI tools.
            - link "View details" [ref=e346] [cursor=pointer]:
              - /url: /events/ai-ad-venture
              - text: View details
              - img [ref=e347]
          - article [ref=e349]:
            - paragraph [ref=e350]:
              - img [ref=e351]
              - text: AUG 30
            - heading "AI & IT Olympiad" [level=3] [ref=e353]
            - paragraph [ref=e354]: A national-level AI and IT challenge with junior and senior solo segments for school, college, and university participants.
            - link "View details" [ref=e355] [cursor=pointer]:
              - /url: /events/ai-it-olympiad
              - text: View details
              - img [ref=e356]
          - article [ref=e358]:
            - paragraph [ref=e359]:
              - img [ref=e360]
              - text: AUG 30
            - heading "TechCare Zone" [level=3] [ref=e362]
            - paragraph [ref=e363]: A festival support booth for software installation and system setup—free for registered participants, with a BDT 100 visitor token.
            - link "View details" [ref=e364] [cursor=pointer]:
              - /url: /events/techcare-zone
              - text: View details
              - img [ref=e365]
        - link "See all events" [ref=e367] [cursor=pointer]:
          - /url: /events
          - text: See all events
          - img [ref=e368]
      - generic [ref=e371]:
        - generic [ref=e372]:
          - paragraph [ref=e373]: Join the society
          - heading "Become a member of JnUITS" [level=2] [ref=e374]
          - paragraph [ref=e375]: Membership is open to all Jagannath University students interested in IT, innovation, and community.
          - list [ref=e376]:
            - listitem [ref=e377]:
              - img [ref=e378]
              - generic [ref=e380]: Priority access to workshops and competitions
            - listitem [ref=e381]:
              - img [ref=e382]
              - generic [ref=e384]: Opportunities to lead and organize events
            - listitem [ref=e385]:
              - img [ref=e386]
              - generic [ref=e388]: Network with peers, alumni, and industry professionals
        - complementary [ref=e389]:
          - link "Apply for membership" [ref=e390] [cursor=pointer]:
            - /url: /members/join
          - link "How membership works" [ref=e391] [cursor=pointer]:
            - /url: /about#membership
            - text: How membership works
            - img [ref=e392]
      - generic [ref=e395]:
        - generic [ref=e396]:
          - paragraph [ref=e397]: What drives us
          - heading "Values at the core of everything we do" [level=2] [ref=e398]
        - generic [ref=e399]:
          - article [ref=e400]:
            - img [ref=e401]
            - heading "Innovation" [level=3] [ref=e403]
            - paragraph [ref=e404]: Encouraging creativity and experimentation with new technologies.
          - article [ref=e405]:
            - img [ref=e406]
            - heading "Collaboration" [level=3] [ref=e411]
            - paragraph [ref=e412]: Building a supportive community of learners and volunteers.
          - article [ref=e413]:
            - img [ref=e414]
            - heading "Excellence" [level=3] [ref=e416]
            - paragraph [ref=e417]: Maintaining high standards in events, projects, and communication.
      - article [ref=e420]:
        - generic [ref=e421]:
          - generic [ref=e422]: MA
          - generic [ref=e423]:
            - heading "Dr. Md. Abu Layek" [level=2] [ref=e424]
            - paragraph [ref=e425]: Moderator & Mentor, JnUITS
        - generic [ref=e426]:
          - blockquote [ref=e427]: Technology is not just a skill - it is a language that shapes the future. Through JnUITS, I have witnessed students transform their...
          - link "Read full message" [ref=e428] [cursor=pointer]:
            - /url: /about#advisor-messages
            - text: Read full message
            - img [ref=e429]
      - generic [ref=e433]:
        - paragraph [ref=e434]: JnUITS is an independent student organization at Jagannath University, Dhaka — open to and run by students from all departments. We align with Jagannath University's mission to support quality education and contribute to national development.
        - link "Visit Jagannath University →" [ref=e435] [cursor=pointer]:
          - /url: https://jnu.ac.bd
  - contentinfo [ref=e436]:
    - generic [ref=e437]:
      - generic [ref=e438]:
        - link "Go to Jagannath University IT Society home" [ref=e439] [cursor=pointer]:
          - /url: /
          - generic [ref=e440]:
            - img "Jagannath University IT Society official logo" [ref=e442]
            - generic [ref=e443]:
              - generic [ref=e444]: JnU IT Society
              - generic [ref=e445]: Step Ahead with IT
        - generic [ref=e446]:
          - link "info@jnuits.org.bd" [ref=e447] [cursor=pointer]:
            - /url: mailto:info@jnuits.org.bd
            - img [ref=e448]
            - generic [ref=e451]: info@jnuits.org.bd
          - link "+880 1721-129467" [ref=e452] [cursor=pointer]:
            - /url: tel:+8801721129467
            - img [ref=e453]
            - generic [ref=e455]: +880 1721-129467
        - navigation "Official JnU IT Society social media" [ref=e456]:
          - link "Facebook opens in a new tab" [ref=e457] [cursor=pointer]:
            - /url: https://www.facebook.com/jnuits
            - img [ref=e458]
          - link "LinkedIn opens in a new tab" [ref=e460] [cursor=pointer]:
            - /url: https://www.linkedin.com/company/jnuits
            - img [ref=e461]
          - link "Facebook Group opens in a new tab" [ref=e463] [cursor=pointer]:
            - /url: https://www.facebook.com/groups/jnuicts
            - img [ref=e464]
          - link "Instagram opens in a new tab" [ref=e467] [cursor=pointer]:
            - /url: https://www.instagram.com/jnuitsbd/
            - img [ref=e468]
          - link "YouTube opens in a new tab" [ref=e472] [cursor=pointer]:
            - /url: https://www.youtube.com/@jnuits
            - img [ref=e473]
          - link "X / Twitter opens in a new tab" [ref=e475] [cursor=pointer]:
            - /url: https://twitter.com/jnuits
            - img [ref=e476]
          - link "Google opens in a new tab" [ref=e478] [cursor=pointer]:
            - /url: https://share.google/zAujqRzHP9xkizOiT
            - img [ref=e479]
      - generic [ref=e482]:
        - paragraph [ref=e483]: Primary
        - generic [ref=e484]:
          - link "About" [ref=e485] [cursor=pointer]:
            - /url: /about
          - link "Committee" [ref=e486] [cursor=pointer]:
            - /url: /committee
          - link "Notices" [ref=e487] [cursor=pointer]:
            - /url: /notices
          - link "Events" [ref=e488] [cursor=pointer]:
            - /url: /events
          - link "Members" [ref=e489] [cursor=pointer]:
            - /url: /members
          - link "Contact" [ref=e490] [cursor=pointer]:
            - /url: /contact
      - generic [ref=e491]:
        - paragraph [ref=e492]: Resources
        - generic [ref=e493]:
          - link "Blogs" [ref=e494] [cursor=pointer]:
            - /url: /blogs
          - link "Certificates" [ref=e495] [cursor=pointer]:
            - /url: /certificates
          - link "Gallery" [ref=e496] [cursor=pointer]:
            - /url: /gallery
          - link "Projects" [ref=e497] [cursor=pointer]:
            - /url: /projects
          - link "Developers" [ref=e498] [cursor=pointer]:
            - /url: /developers
          - link "Join now" [ref=e499] [cursor=pointer]:
            - /url: /membership-form
      - generic [ref=e500]:
        - paragraph [ref=e501]: Policies
        - generic [ref=e502]:
          - link "Privacy Policy" [ref=e503] [cursor=pointer]:
            - /url: /privacy-policy
          - link "Terms of Service" [ref=e504] [cursor=pointer]:
            - /url: /terms-of-service
          - link "Cookie Policy" [ref=e505] [cursor=pointer]:
            - /url: /cookie-policy
      - generic [ref=e506]:
        - paragraph [ref=e507]: Newsletter
        - paragraph [ref=e508]: Get updates about events, notices, and member opportunities.
        - generic [ref=e509]:
          - generic [ref=e510]: Email address
          - textbox "Email address" [ref=e511]:
            - /placeholder: you@example.com
          - generic [ref=e512]:
            - text: Website
            - textbox [ref=e513]
          - button "Subscribe" [ref=e514] [cursor=pointer]
  - alert [ref=e515]
```

# Test source

```ts
  178 | 
  179 | const festEventRoutes = [
  180 |   {
  181 |     deadline: "2026-08-15T17:59:00Z",
  182 |     slug: "ai-it-olympiad",
  183 |     title: "AI & IT Olympiad",
  184 |   },
  185 |   {
  186 |     deadline: "2026-08-15T17:59:00Z",
  187 |     slug: "techuncut",
  188 |     title: "TechUncut",
  189 |   },
  190 |   {
  191 |     deadline: "2026-08-15T17:59:00Z",
  192 |     slug: "techcare-zone",
  193 |     title: "TechCare Zone",
  194 |   },
  195 |   {
  196 |     deadline: "2026-08-15T17:59:00Z",
  197 |     slug: "ai-ad-venture",
  198 |     title: "AI Ad-Venture",
  199 |   },
  200 |   {
  201 |     deadline: "2026-08-20T17:59:59Z",
  202 |     slug: "brainchild-season-2-0",
  203 |     title: "BrainChild Season 2.0",
  204 |   },
  205 | ];
  206 | 
  207 | test.describe("published AI and IT Fest campaign", () => {
  208 |   test.skip(
  209 |     process.env.PLAYWRIGHT_EXPECT_FEST_CAMPAIGN !== "1",
  210 |     "Requires the verified production drafts to be published after the lifecycle fix deploys."
  211 |   );
  212 | 
  213 |   for (const viewport of responsiveViewports) {
  214 |     test(`${viewport.label} homepage keeps four cards and one core BrainChild feature`, async ({
  215 |       page,
  216 |     }) => {
  217 |       const consoleErrors: string[] = [];
  218 |       page.on("console", (message) => {
  219 |         if (message.type() === "error") {
  220 |           consoleErrors.push(message.text());
  221 |         }
  222 |       });
  223 |       await page.setViewportSize({
  224 |         height: viewport.height,
  225 |         width: viewport.width,
  226 |       });
  227 |       await expectStablePage(page, "/");
  228 | 
  229 |       const campaign = page.getByRole("region", {
  230 |         name: "JnU AI & IT Fest 2026",
  231 |       });
  232 |       await expect(campaign).toBeVisible();
  233 |       await expect(
  234 |         campaign.getByRole("heading", {
  235 |           level: 1,
  236 |           name: "JnU AI & IT Fest 2026",
  237 |         })
  238 |       ).toBeVisible();
  239 |       await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  240 | 
  241 |       const showcase = campaign.getByRole("region", {
  242 |         name: "Fest event showcase",
  243 |       });
  244 |       await expect(showcase.getByRole("article")).toHaveCount(4);
  245 |       await expect(
  246 |         campaign.getByRole("region", { name: "BrainChild core event" })
  247 |       ).toHaveCount(1);
  248 |       await expect(
  249 |         campaign.getByRole("heading", { name: "BrainChild Season 2.0" })
  250 |       ).toHaveCount(1);
  251 |       await expect(
  252 |         campaign.getByText(/Jagannath University IT Society/i)
  253 |       ).toBeVisible();
  254 | 
  255 |       await expect(
  256 |         campaign.getByRole("link", { name: /Explore the Fest/i })
  257 |       ).toHaveAttribute("href", "https://itfest.jnuits.org.bd/");
  258 |       await expect(
  259 |         campaign.getByRole("link", { name: "Register for BrainChild" })
  260 |       ).toHaveAttribute("href", "https://brainchild.jnuits.org.bd/register");
  261 |       await expect(
  262 |         campaign.getByRole("link", { name: "Track registration" })
  263 |       ).toHaveAttribute("href", "https://brainchild.jnuits.org.bd/track");
  264 | 
  265 |       const imagesLoaded = await campaign.getByRole("img").evaluateAll((images) =>
  266 |         images.every(
  267 |           (image) => image instanceof HTMLImageElement && image.naturalWidth > 0
  268 |         )
  269 |       );
  270 |       expect(imagesLoaded, "campaign image loading").toBe(true);
  271 | 
  272 |       const primaryAction = campaign.getByRole("link", {
  273 |         name: /Explore the Fest/i,
  274 |       });
  275 |       await primaryAction.focus();
  276 |       await expect(primaryAction).toBeFocused();
  277 |       await expectNoHorizontalOverflow(page);
> 278 |       expect(consoleErrors, "campaign console errors").toEqual([]);
      |                                                        ^ Error: campaign console errors
  279 |     });
  280 |   }
  281 | 
  282 |   for (const event of festEventRoutes) {
  283 |     test(`${event.slug} uses its canonical cover and deadline-aware CTA`, async ({
  284 |       page,
  285 |     }) => {
  286 |       await expectStablePage(page, `/events/${event.slug}`);
  287 |       await expect(
  288 |         page.getByRole("heading", { level: 1, name: event.title })
  289 |       ).toBeVisible();
  290 |       await expect(
  291 |         page.getByRole("img", { name: new RegExp(event.title, "i") })
  292 |       ).toBeVisible();
  293 | 
  294 |       const externalRegistration = page.getByRole("link", {
  295 |         name: "Register externally",
  296 |       });
  297 |       if (Date.now() >= Date.parse(event.deadline)) {
  298 |         await expect(externalRegistration).toHaveCount(0);
  299 |       } else {
  300 |         await expect(externalRegistration).toBeVisible();
  301 |       }
  302 |     });
  303 |   }
  304 | });
  305 | 
```