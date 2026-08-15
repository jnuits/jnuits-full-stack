# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> published AI and IT Fest campaign >> desktop homepage keeps four cards and one core BrainChild feature
- Location: e2e\smoke.spec.ts:214:9

# Error details

```
Error: campaign image loading

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - banner [ref=e2]:
    - generic [ref=e4]:
      - link "Go to Jagannath University IT Society home" [ref=e5] [cursor=pointer]:
        - /url: /
        - generic [ref=e6]:
          - img "Jagannath University IT Society official logo" [ref=e8]
          - generic [ref=e9]:
            - generic [ref=e10]: JnU IT Society
            - generic [ref=e11]: Step Ahead with IT
      - navigation "Primary navigation" [ref=e12]:
        - link "About" [ref=e13] [cursor=pointer]:
          - /url: /about
        - link "Committee" [ref=e14] [cursor=pointer]:
          - /url: /committee
        - link "Notices" [ref=e15] [cursor=pointer]:
          - /url: /notices
        - link "Events" [ref=e16] [cursor=pointer]:
          - /url: /events
        - button "Resources" [ref=e18] [cursor=pointer]:
          - text: Resources
          - img [ref=e19]
        - button "Members" [ref=e22] [cursor=pointer]:
          - text: Members
          - img [ref=e23]
        - link "Contact" [ref=e25] [cursor=pointer]:
          - /url: /contact
      - generic [ref=e26]:
        - button "Toggle color theme" [ref=e27] [cursor=pointer]:
          - img [ref=e29]
        - link "Portal" [ref=e31] [cursor=pointer]:
          - /url: /portal/dashboard
  - main [ref=e32]:
    - generic [ref=e33]:
      - region "JnU AI & IT Fest 2026" [ref=e34]:
        - generic [ref=e35]:
          - generic [ref=e36]:
            - generic [ref=e37]:
              - paragraph [ref=e38]:
                - img [ref=e39]
                - text: Presented by Jagannath University IT Society
              - heading "JnU AI & IT Fest 2026" [level=1] [ref=e42]
              - paragraph [ref=e43]: Where Ideas Meet Intelligence
              - paragraph [ref=e44]: "Where Ideas Meet Intelligence: JnUITS presents a day of AI, technology, creativity, support, and student innovation at Jagannath University."
              - generic [ref=e45]:
                - generic [ref=e46]:
                  - img [ref=e47]
                  - text: Aug 30, 2026
                - generic [ref=e49]:
                  - img [ref=e50]
                  - text: Jagannath University
              - generic [ref=e53]:
                - link "Explore the Fest" [ref=e54] [cursor=pointer]:
                  - /url: https://itfest.jnuits.org.bd/
                  - text: Explore the Fest
                  - img [ref=e55]
                - link "View JnUITS events" [ref=e59] [cursor=pointer]:
                  - /url: /events
                  - text: View JnUITS events
                  - img [ref=e60]
            - generic [ref=e62]:
              - img "JnU AI & IT Fest 2026 official campaign artwork" [ref=e63]
              - generic [ref=e64]: Official Fest programme
          - region "Fest event showcase" [ref=e65]:
            - generic [ref=e66]:
              - paragraph [ref=e67]: Four ways to take part
              - heading "Fest event showcase" [level=2] [ref=e68]
            - generic [ref=e69]:
              - article "AI & IT Olympiad" [ref=e70]:
                - generic [ref=e71]:
                  - img "AI & IT Olympiad official event artwork" [ref=e72]
                  - generic [ref=e73]: Upcoming
                - generic [ref=e74]:
                  - generic [ref=e75]:
                    - generic [ref=e76]:
                      - img [ref=e77]
                      - text: Solo
                    - generic [ref=e82]: BDT 200
                  - heading "AI & IT Olympiad" [level=3] [ref=e83]
                  - paragraph [ref=e84]: A national-level AI and IT challenge with junior and senior solo segments for school, college, and university participants.
                  - generic [ref=e85]:
                    - generic [ref=e86]:
                      - term [ref=e87]:
                        - img [ref=e88]
                        - text: Event
                      - definition [ref=e90]: Aug 30, 2026
                    - generic [ref=e91]:
                      - term [ref=e92]:
                        - img [ref=e93]
                        - text: Registration closes
                      - definition [ref=e96]: Aug 15, 2026, 11:59 PM
                  - generic [ref=e97]:
                    - link "View details" [ref=e98] [cursor=pointer]:
                      - /url: /events/ai-it-olympiad
                      - text: View details
                      - img [ref=e99]
                    - link "Register now" [ref=e101] [cursor=pointer]:
                      - /url: https://itfest.jnuits.org.bd/events/ai-it-olympiad
                      - text: Register now
                      - img [ref=e102]
              - article "TechUncut" [ref=e106]:
                - generic [ref=e107]:
                  - img "TechUncut official event artwork" [ref=e108]
                  - generic [ref=e109]: Upcoming
                - generic [ref=e110]:
                  - generic [ref=e111]:
                    - generic [ref=e112]:
                      - img [ref=e113]
                      - text: Solo admission
                    - generic [ref=e118]: BDT 200
                  - heading "TechUncut" [level=3] [ref=e119]
                  - paragraph [ref=e120]: The Fest's flagship conference, bringing creators and AI pioneers together for talks on technology, careers, research, and innovation.
                  - generic [ref=e121]:
                    - generic [ref=e122]:
                      - term [ref=e123]:
                        - img [ref=e124]
                        - text: Event
                      - definition [ref=e126]: Aug 30, 2026
                    - generic [ref=e127]:
                      - term [ref=e128]:
                        - img [ref=e129]
                        - text: Registration closes
                      - definition [ref=e132]: Aug 15, 2026, 11:59 PM
                  - generic [ref=e133]:
                    - link "View details" [ref=e134] [cursor=pointer]:
                      - /url: /events/techuncut
                      - text: View details
                      - img [ref=e135]
                    - link "Register now" [ref=e137] [cursor=pointer]:
                      - /url: https://itfest.jnuits.org.bd/events/techuncut
                      - text: Register now
                      - img [ref=e138]
              - article "TechCare Zone" [ref=e142]:
                - generic [ref=e143]:
                  - img "TechCare Zone official event artwork" [ref=e144]
                  - generic [ref=e145]: Upcoming
                - generic [ref=e146]:
                  - generic [ref=e147]:
                    - generic [ref=e148]:
                      - img [ref=e149]
                      - text: Individual service
                    - generic [ref=e154]: Free for Fest participants · BDT 100 visitor token
                  - heading "TechCare Zone" [level=3] [ref=e155]
                  - paragraph [ref=e156]: A festival support booth for software installation and system setup—free for registered participants, with a BDT 100 visitor token.
                  - generic [ref=e157]:
                    - generic [ref=e158]:
                      - term [ref=e159]:
                        - img [ref=e160]
                        - text: Event
                      - definition [ref=e162]: Aug 30, 2026
                    - generic [ref=e163]:
                      - term [ref=e164]:
                        - img [ref=e165]
                        - text: Registration closes
                      - definition [ref=e168]: Aug 15, 2026, 11:59 PM
                  - generic [ref=e169]:
                    - link "View details" [ref=e170] [cursor=pointer]:
                      - /url: /events/techcare-zone
                      - text: View details
                      - img [ref=e171]
                    - link "Register now" [ref=e173] [cursor=pointer]:
                      - /url: https://itfest.jnuits.org.bd/events/techcare-zone
                      - text: Register now
                      - img [ref=e174]
              - article "AI Ad-Venture" [ref=e178]:
                - generic [ref=e179]:
                  - img "AI Ad-Venture official event artwork" [ref=e180]
                  - generic [ref=e181]: Upcoming
                - generic [ref=e182]:
                  - generic [ref=e183]:
                    - generic [ref=e184]:
                      - img [ref=e185]
                      - text: Team of 2-5
                    - generic [ref=e190]: BDT 300 per team
                  - heading "AI Ad-Venture" [level=3] [ref=e191]
                  - paragraph [ref=e192]: A national prompt-to-production challenge where teams of 2-5 create promotional advertisements using generative AI tools.
                  - generic [ref=e193]:
                    - generic [ref=e194]:
                      - term [ref=e195]:
                        - img [ref=e196]
                        - text: Event
                      - definition [ref=e198]: Aug 30, 2026
                    - generic [ref=e199]:
                      - term [ref=e200]:
                        - img [ref=e201]
                        - text: Registration closes
                      - definition [ref=e204]: Aug 15, 2026, 11:59 PM
                  - generic [ref=e205]:
                    - link "View details" [ref=e206] [cursor=pointer]:
                      - /url: /events/ai-ad-venture
                      - text: View details
                      - img [ref=e207]
                    - link "Register now" [ref=e209] [cursor=pointer]:
                      - /url: https://itfest.jnuits.org.bd/events/ai-ad-venture
                      - text: Register now
                      - img [ref=e210]
          - region "BrainChild core event" [ref=e214]:
            - generic [ref=e215]:
              - img "BrainChild Season 2.0 official campaign artwork" [ref=e216]
              - generic [ref=e217]: Core event
            - generic [ref=e218]:
              - paragraph [ref=e219]: National App, Web & AI Project Expo
              - heading "BrainChild Season 2.0" [level=2] [ref=e220]
              - paragraph [ref=e221]: The Fest's core national app, web, and AI project expo for student teams of 2-3, with the top 15 shortlisted for the live exhibition.
              - generic [ref=e222]:
                - generic [ref=e223]:
                  - img [ref=e224]
                  - text: Team of 2-3
                - generic [ref=e229]: BDT 2,000 per team
                - generic [ref=e230]:
                  - img [ref=e231]
                  - text: Deadline Aug 20, 2026, 11:59:59 PM
              - generic [ref=e234]:
                - link "Register for BrainChild" [ref=e235] [cursor=pointer]:
                  - /url: https://brainchild.jnuits.org.bd/register
                  - text: Register for BrainChild
                  - img [ref=e236]
                - link "Track registration" [ref=e240] [cursor=pointer]:
                  - /url: https://brainchild.jnuits.org.bd/track
              - navigation "BrainChild resources" [ref=e241]:
                - link "Explore BrainChild" [ref=e242] [cursor=pointer]:
                  - /url: https://brainchild.jnuits.org.bd/
                  - text: Explore BrainChild
                  - img [ref=e243]
                - link "Read rulebook" [ref=e247] [cursor=pointer]:
                  - /url: https://drive.google.com/file/d/1txSeyWJIOFxNW3XFUmjYZMrkN6uEemFj/view?usp=sharing
                  - text: Read rulebook
                  - img [ref=e248]
          - link "Explore every official Fest event" [ref=e253] [cursor=pointer]:
            - /url: https://itfest.jnuits.org.bd/events
            - text: Explore every official Fest event
            - img [ref=e254]
      - generic [ref=e258]:
        - generic [ref=e259]: Step Ahead with IT
        - heading "Jagannath University IT Society" [level=2] [ref=e260]:
          - text: Jagannath University
          - text: IT Society
        - paragraph [ref=e261]: JnUITS is the official student IT club of Jagannath University — offering workshops, coding competitions, tech talks, and community-driven programs that bridge academic learning with real-world IT skills.
        - generic [ref=e262]:
          - link "Join JnUITS" [ref=e263] [cursor=pointer]:
            - /url: /members/join
          - link "Explore events" [ref=e264] [cursor=pointer]:
            - /url: /events
      - generic "JnUITS activity gallery" [ref=e267]:
        - generic [ref=e268]:
          - generic [ref=e269]:
            - img "Inauguration & Fresher's Reception 2023-2024" [ref=e270]
            - paragraph [ref=e271]: Inauguration & Fresher's Reception 2023-2024
            - paragraph [ref=e272]: Introducing JnUITS ID Card
            - link "View Inauguration & Fresher's Reception 2023-2024" [ref=e273] [cursor=pointer]:
              - /url: /gallery/inauguration-and-fresher-s-reception-2023-2024
              - text: View →
          - generic:
            - img
            - paragraph: Mastering the Art of Digital Communications
            - paragraph: Guest speakers connect classroom learning with real technology careers.
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
          - button "Previous slide" [ref=e274] [cursor=pointer]:
            - img [ref=e275]
          - button "Next slide" [ref=e277] [cursor=pointer]:
            - img [ref=e278]
        - tablist "Slider navigation" [ref=e280]:
          - tab "Slide 1 of 5" [selected] [ref=e281] [cursor=pointer]
          - tab "Slide 2 of 5" [ref=e282] [cursor=pointer]
          - tab "Slide 3 of 5" [ref=e283] [cursor=pointer]
          - tab "Slide 4 of 5" [ref=e284] [cursor=pointer]
          - tab "Slide 5 of 5" [ref=e285] [cursor=pointer]
      - region "JnUITS impact statistics" [ref=e286]:
        - generic [ref=e288]:
          - generic [ref=e289]:
            - paragraph [ref=e290]: 300+
            - paragraph [ref=e291]: Active members
          - generic [ref=e292]:
            - paragraph [ref=e293]: 150+
            - paragraph [ref=e294]: Events organized
          - generic [ref=e295]:
            - paragraph [ref=e296]: 10+
            - paragraph [ref=e297]: Years active
          - generic [ref=e298]:
            - paragraph [ref=e299]: 6+
            - paragraph [ref=e300]: Executive terms
          - generic [ref=e301]:
            - paragraph [ref=e302]: 2000+
            - paragraph [ref=e303]: Alumni & community
      - article "ABOUT JNUITS" [ref=e306]:
        - paragraph [ref=e307]: ABOUT JNUITS
        - paragraph [ref=e308]: JnUITS is the official student IT club of Jagannath University, helping students move from academic learning into practical technology work. Through workshops, coding competitions, tech talks, mentoring, and community-driven programs, the society creates a bridge between classroom knowledge and real-world IT skills.
        - link "Learn more about JnUITS →" [ref=e309] [cursor=pointer]:
          - /url: /about
      - generic [ref=e311]:
        - generic [ref=e312]:
          - paragraph [ref=e313]: What we do
          - heading "Programs built for real skills" [level=2] [ref=e314]
        - generic [ref=e315]:
          - article [ref=e316]:
            - img [ref=e318]
            - heading "Workshops & Courses" [level=3] [ref=e320]
            - paragraph [ref=e321]: Hands-on sessions covering programming, web development, cybersecurity, and data science.
          - article [ref=e322]:
            - img [ref=e324]
            - heading "Competitions & Hackathons" [level=3] [ref=e330]
            - paragraph [ref=e331]: Coding contests and IT challenges where students solve real problems and showcase skills nationally.
          - article [ref=e332]:
            - img [ref=e334]
            - heading "Networking & Career Growth" [level=3] [ref=e339]
            - paragraph [ref=e340]: Events connecting students with industry professionals, alumni, and mentors for career guidance.
          - article [ref=e341]:
            - img [ref=e343]
            - heading "Community & Social Impact" [level=3] [ref=e345]
            - paragraph [ref=e346]: Initiatives applying technology to community needs and public-interest projects beyond the campus.
      - generic [ref=e348]:
        - generic [ref=e349]:
          - paragraph [ref=e350]: What's coming up
          - heading "Upcoming events" [level=2] [ref=e351]
        - generic [ref=e352]:
          - article [ref=e353]:
            - paragraph [ref=e354]:
              - img [ref=e355]
              - text: AUG 30
            - heading "AI Ad-Venture" [level=3] [ref=e357]
            - paragraph [ref=e358]: A national prompt-to-production challenge where teams of 2-5 create promotional advertisements using generative AI tools.
            - link "View details" [ref=e359] [cursor=pointer]:
              - /url: /events/ai-ad-venture
              - text: View details
              - img [ref=e360]
          - article [ref=e362]:
            - paragraph [ref=e363]:
              - img [ref=e364]
              - text: AUG 30
            - heading "AI & IT Olympiad" [level=3] [ref=e366]
            - paragraph [ref=e367]: A national-level AI and IT challenge with junior and senior solo segments for school, college, and university participants.
            - link "View details" [ref=e368] [cursor=pointer]:
              - /url: /events/ai-it-olympiad
              - text: View details
              - img [ref=e369]
          - article [ref=e371]:
            - paragraph [ref=e372]:
              - img [ref=e373]
              - text: AUG 30
            - heading "TechCare Zone" [level=3] [ref=e375]
            - paragraph [ref=e376]: A festival support booth for software installation and system setup—free for registered participants, with a BDT 100 visitor token.
            - link "View details" [ref=e377] [cursor=pointer]:
              - /url: /events/techcare-zone
              - text: View details
              - img [ref=e378]
        - link "See all events" [ref=e380] [cursor=pointer]:
          - /url: /events
          - text: See all events
          - img [ref=e381]
      - generic [ref=e384]:
        - generic [ref=e385]:
          - paragraph [ref=e386]: Join the society
          - heading "Become a member of JnUITS" [level=2] [ref=e387]
          - paragraph [ref=e388]: Membership is open to all Jagannath University students interested in IT, innovation, and community.
          - list [ref=e389]:
            - listitem [ref=e390]:
              - img [ref=e391]
              - generic [ref=e393]: Priority access to workshops and competitions
            - listitem [ref=e394]:
              - img [ref=e395]
              - generic [ref=e397]: Opportunities to lead and organize events
            - listitem [ref=e398]:
              - img [ref=e399]
              - generic [ref=e401]: Network with peers, alumni, and industry professionals
        - complementary [ref=e402]:
          - link "Apply for membership" [ref=e403] [cursor=pointer]:
            - /url: /members/join
          - link "How membership works" [ref=e404] [cursor=pointer]:
            - /url: /about#membership
            - text: How membership works
            - img [ref=e405]
      - generic [ref=e408]:
        - generic [ref=e409]:
          - paragraph [ref=e410]: What drives us
          - heading "Values at the core of everything we do" [level=2] [ref=e411]
        - generic [ref=e412]:
          - article [ref=e413]:
            - img [ref=e414]
            - heading "Innovation" [level=3] [ref=e416]
            - paragraph [ref=e417]: Encouraging creativity and experimentation with new technologies.
          - article [ref=e418]:
            - img [ref=e419]
            - heading "Collaboration" [level=3] [ref=e424]
            - paragraph [ref=e425]: Building a supportive community of learners and volunteers.
          - article [ref=e426]:
            - img [ref=e427]
            - heading "Excellence" [level=3] [ref=e429]
            - paragraph [ref=e430]: Maintaining high standards in events, projects, and communication.
      - article [ref=e433]:
        - generic [ref=e434]:
          - generic [ref=e435]: MA
          - generic [ref=e436]:
            - heading "Dr. Md. Abu Layek" [level=2] [ref=e437]
            - paragraph [ref=e438]: Moderator & Mentor, JnUITS
        - generic [ref=e439]:
          - blockquote [ref=e440]: Technology is not just a skill - it is a language that shapes the future. Through JnUITS, I have witnessed students transform their curiosity into capability, their ideas into...
          - link "Read full message" [ref=e441] [cursor=pointer]:
            - /url: /about#advisor-messages
            - text: Read full message
            - img [ref=e442]
      - generic [ref=e446]:
        - paragraph [ref=e447]: JnUITS is an independent student organization at Jagannath University, Dhaka — open to and run by students from all departments. We align with Jagannath University's mission to support quality education and contribute to national development.
        - link "Visit Jagannath University →" [ref=e448] [cursor=pointer]:
          - /url: https://jnu.ac.bd
  - contentinfo [ref=e449]:
    - generic [ref=e450]:
      - generic [ref=e451]:
        - link "Go to Jagannath University IT Society home" [ref=e452] [cursor=pointer]:
          - /url: /
          - generic [ref=e453]:
            - img "Jagannath University IT Society official logo" [ref=e455]
            - generic [ref=e456]:
              - generic [ref=e457]: JnU IT Society
              - generic [ref=e458]: Step Ahead with IT
        - generic [ref=e459]:
          - link "info@jnuits.org.bd" [ref=e460] [cursor=pointer]:
            - /url: mailto:info@jnuits.org.bd
            - img [ref=e461]
            - generic [ref=e464]: info@jnuits.org.bd
          - link "+880 1721-129467" [ref=e465] [cursor=pointer]:
            - /url: tel:+8801721129467
            - img [ref=e466]
            - generic [ref=e468]: +880 1721-129467
        - navigation "Official JnU IT Society social media" [ref=e469]:
          - link "Facebook opens in a new tab" [ref=e470] [cursor=pointer]:
            - /url: https://www.facebook.com/jnuits
            - img [ref=e471]
          - link "LinkedIn opens in a new tab" [ref=e473] [cursor=pointer]:
            - /url: https://www.linkedin.com/company/jnuits
            - img [ref=e474]
          - link "Facebook Group opens in a new tab" [ref=e476] [cursor=pointer]:
            - /url: https://www.facebook.com/groups/jnuicts
            - img [ref=e477]
          - link "Instagram opens in a new tab" [ref=e480] [cursor=pointer]:
            - /url: https://www.instagram.com/jnuitsbd/
            - img [ref=e481]
          - link "YouTube opens in a new tab" [ref=e485] [cursor=pointer]:
            - /url: https://www.youtube.com/@jnuits
            - img [ref=e486]
          - link "X / Twitter opens in a new tab" [ref=e488] [cursor=pointer]:
            - /url: https://twitter.com/jnuits
            - img [ref=e489]
          - link "Google opens in a new tab" [ref=e491] [cursor=pointer]:
            - /url: https://share.google/zAujqRzHP9xkizOiT
            - img [ref=e492]
      - generic [ref=e495]:
        - paragraph [ref=e496]: Primary
        - generic [ref=e497]:
          - link "About" [ref=e498] [cursor=pointer]:
            - /url: /about
          - link "Committee" [ref=e499] [cursor=pointer]:
            - /url: /committee
          - link "Notices" [ref=e500] [cursor=pointer]:
            - /url: /notices
          - link "Events" [ref=e501] [cursor=pointer]:
            - /url: /events
          - link "Members" [ref=e502] [cursor=pointer]:
            - /url: /members
          - link "Contact" [ref=e503] [cursor=pointer]:
            - /url: /contact
      - generic [ref=e504]:
        - paragraph [ref=e505]: Resources
        - generic [ref=e506]:
          - link "Blogs" [ref=e507] [cursor=pointer]:
            - /url: /blogs
          - link "Certificates" [ref=e508] [cursor=pointer]:
            - /url: /certificates
          - link "Gallery" [ref=e509] [cursor=pointer]:
            - /url: /gallery
          - link "Projects" [ref=e510] [cursor=pointer]:
            - /url: /projects
          - link "Developers" [ref=e511] [cursor=pointer]:
            - /url: /developers
          - link "Join now" [ref=e512] [cursor=pointer]:
            - /url: /membership-form
      - generic [ref=e513]:
        - paragraph [ref=e514]: Policies
        - generic [ref=e515]:
          - link "Privacy Policy" [ref=e516] [cursor=pointer]:
            - /url: /privacy-policy
          - link "Terms of Service" [ref=e517] [cursor=pointer]:
            - /url: /terms-of-service
          - link "Cookie Policy" [ref=e518] [cursor=pointer]:
            - /url: /cookie-policy
      - generic [ref=e519]:
        - paragraph [ref=e520]: Newsletter
        - paragraph [ref=e521]: Get updates about events, notices, and member opportunities.
        - generic [ref=e522]:
          - generic [ref=e523]: Email address
          - textbox "Email address" [ref=e524]:
            - /placeholder: you@example.com
          - generic [ref=e525]:
            - text: Website
            - textbox [ref=e526]
          - button "Subscribe" [ref=e527] [cursor=pointer]
  - alert [ref=e528]
```

# Test source

```ts
  170 |     await expect(page.getByLabel(/password/i)).toBeFocused();
  171 | 
  172 |     await page.goto("/portal/login");
  173 |     await page.getByRole("textbox", { name: /email/i }).focus();
  174 |     await page.keyboard.press("Tab");
  175 |     await expect(page.getByLabel(/password/i)).toBeFocused();
  176 |   });
  177 | });
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
> 270 |       expect(imagesLoaded, "campaign image loading").toBe(true);
      |                                                      ^ Error: campaign image loading
  271 | 
  272 |       const primaryAction = campaign.getByRole("link", {
  273 |         name: /Explore the Fest/i,
  274 |       });
  275 |       await primaryAction.focus();
  276 |       await expect(primaryAction).toBeFocused();
  277 |       await expectNoHorizontalOverflow(page);
  278 |       expect(consoleErrors, "campaign console errors").toEqual([]);
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