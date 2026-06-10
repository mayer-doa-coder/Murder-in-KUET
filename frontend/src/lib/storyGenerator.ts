import { ALL_CARDS } from '../types'

const BY_ID = Object.fromEntries(ALL_CARDS.map(c => [c.id, c]))

// Suspect-specific role descriptions used to enrich story context
const SUSPECT_ROLE: Record<string, string> = {
  chef:           'the campus chef — who moves freely between the kitchen, the serving counter, and the back corridors at all hours',
  hallboy:        'the hall attendant — whose master keys and errand routes gave access to every room and corridor',
  security_guard: 'the security guard on duty — whose patrol schedule, CCTV access, and gate keys made them uniquely invisible to suspicion',
  shopkeeper:     'the campus shopkeeper — whose stall near the main routes let them watch, wait, and move without drawing attention',
  student_girl:   'a third-year student — who had been seen in places she had no reason to be in the days before the incident',
  student_boy:    'a second-year student — restless, argumentative, and known to push limits well past midnight',
}

// How each weapon was used in the crime
const WEAPON_DETAIL: Record<string, string> = {
  knife:          'a kitchen knife that had been sharpened recently and wiped clean — but not clean enough',
  sleeping_pills: 'a dissolved dose of sleeping pills slipped into an unattended drink — odourless, colourless, untraceable until the autopsy',
  revolver:       'a revolver fired once at close range, the sound muffled by the thick walls and the hour',
  laptop_charger: 'a laptop charger used as a cord — looped and pulled tight in the dark before anyone could react',
  anti_cutter:    'an anti-cutter drawn from a front pocket and used with one practiced motion',
  rope:           'a length of rope that had been hidden inside a bag for days, waiting for the right moment',
}

// Location-specific story templates — 3 per location
// Each receives (suspectName, suspectRole, weaponName, weaponDetail)
type StoryFn = (s: string, sRole: string, w: string, wDetail: string) => string

const LOCATION_STORIES: Record<string, StoryFn[]> = {

  auditorium: [
    (s, sRole, _w, wDetail) =>
      `The auditorium had been locked since the evening programme ended at nine. Or so everyone assumed. ${s} — ${sRole} — had slipped back inside before the caretaker turned the deadbolt, using a side entrance near the stage left wing. A student arriving early the next morning for rehearsals found the stage lights still burning, a podium mic left on, and the body slumped across the front row seats. Investigators found ${wDetail} tucked beneath a velvet seat cushion in the third row. ${s} had no credible explanation for why their personal belongings were found backstage.`,

    (s, sRole, _w, wDetail) =>
      `The grand auditorium of KUET holds nine hundred. On the night of the murder, it held only two. ${s} — ${sRole} — had volunteered to remain behind after the convocation rehearsal, claiming they needed to retrieve a forgotten item from the sound booth at the back of the hall. The caretaker trusted them and left. By the time the body was discovered the following morning beneath the stage rigging, the lights had been dimmed to a single amber spotlight — still aimed at the podium. ${wDetail} was recovered from behind the curtain rigging, and CCTV from the lobby corridor placed ${s} inside the building for over two hours.`,

    (s, sRole, _w, wDetail) =>
      `Witnesses reported hearing a commotion from the direction of the auditorium just before eleven PM — a scraping sound, then silence, then footsteps moving quickly toward the side gate. ${s} — ${sRole} — was seen on three separate camera feeds that night, each time closer to the auditorium entrance. The stage curtains had been disturbed, and several front-row seats were displaced. ${wDetail} was found behind the emergency exit door, and a partial print matched ${s}'s records. They claimed to have been elsewhere, but the theatre's own logbook recorded their entry code.`,
  ],

  student_welfare: [
    (s, sRole, _w, wDetail) =>
      `The Student Welfare Centre is supposed to be a sanctuary. The counselling files stored in its back office contain the most sensitive confessions on campus — and someone wanted one of them gone. ${s} — ${sRole} — had visited the centre twice in the preceding week under the guise of personal sessions. On the night of the incident, the duty officer stepped away for fifteen minutes. When she returned, the back counselling room had been ransacked, and the victim was found slumped at the reception desk. ${wDetail} was discovered inside the filing cabinet's bottom drawer, wrapped in a session transcript that bore ${s}'s name.`,

    (s, sRole, _w, wDetail) =>
      `Staff at the welfare centre later recalled that ${s} — ${sRole} — had seemed agitated during their last formal visit, insisting on a room with a closed door and refusing to leave when the session ended. On the night of the murder, a janitor saw ${s} near the side entrance of the building at 10:52 PM. The welfare office's CCTV recorded motion in the corridor at 11:09 PM — but the camera covering the counselling rooms had been unplugged. ${wDetail} was found under the waiting room bench, partially obscured by a chair. The victim had a scheduled appointment with ${s} the very next morning.`,

    (s, sRole, _w, wDetail) =>
      `A colleague of the victim mentioned that she had been increasingly anxious in the days before the murder — telling friends she had seen something she shouldn't have at the Student Welfare Centre. ${s} — ${sRole} — had access to the building during off hours and had been observed reviewing files that were not their own. The night of the incident, the front door's electronic lock showed an access attempt at 11:34 PM followed by a successful entry. ${wDetail} was recovered from behind the noticeboard in the waiting area. ${s}'s keycard was the last one logged on the system before the body was found.`,
  ],

  amar_ekushey: [
    (s, sRole, _w, wDetail) =>
      `Amar Ekushey Hall never truly sleeps. Residents come and go past midnight, and the duty hall boy rarely challenges a familiar face. ${s} — ${sRole} — was precisely that: familiar. Known to most residents, trusted by the hall administration. On the night of the murder, the victim had returned to the dormitory late after an argument, which several bunkmates overheard. By morning, the victim was gone — not checked out, just gone. ${wDetail} was found tucked beneath the mattress of the bunk directly below where the victim used to sleep. ${s}'s fingerprints were on the footlocker beside it.`,

    (s, sRole, _w, wDetail) =>
      `The second floor corridor of Amar Ekushey Hall is poorly lit after the night staff reduces power at midnight. ${s} — ${sRole} — knew that. Three residents independently recalled hearing the sound of a brief, muffled confrontation in that corridor around 12:20 AM. None of them got up to check. The following morning, investigators found drag marks on the floor tiles near the communal bathroom. ${wDetail} was recovered from inside a cloth bag pushed behind the water pipes beneath the wash basins. The bag had ${s}'s initials written in faded marker on the strap.`,

    (s, sRole, _w, wDetail) =>
      `${s} — ${sRole} — had been seen entering the dormitory three times in a single evening, each visit shorter than the last, as though testing something. The hall's visitor register showed the last entry at 11:47 PM. By 1 AM the building was locked from the outside, but the duty boy confirmed he had seen ${s} still inside after that. The victim's study desk had been overturned, textbooks scattered. ${wDetail} was found lodged behind a study desk in the shared room, alongside a torn piece of cloth matching ${s}'s known attire. No alibi was ever established.`,
  ],

  cafeteria: [
    (s, sRole, _w, wDetail) =>
      `The cafeteria kitchen runs on routine — meal prep by five, service by seven, cleanup by ten. After that, the back rooms belong to whoever has a key. ${s} — ${sRole} — had exactly that. On the night in question, the serving counter was left in chaos: a pot of tea overturned on the burner, metal trays knocked to the floor in a row, and one of the steam table covers left open. The victim had apparently stayed behind after closing to speak with someone. ${wDetail} was found lodged behind the commercial refrigerator unit at the far end of the kitchen. ${s} had signed into the premises at 9:43 PM and was not recorded leaving.`,

    (s, sRole, _w, wDetail) =>
      `The cafeteria regulars remembered ${s} — ${sRole} — as someone who was always watching the room, always present at the margins of other people's conversations. On the night of the murder, the catering trainee on closing duty saw ${s} linger near the back of the kitchen long past the time the serving window had been shuttered. By morning, a cold trail of footprints led from the cold storage room to the emergency exit. ${wDetail} was discovered inside the waste bin behind the cooking station, wrapped in a catering apron. The chef's knife rack was missing one blade — a blade that matched the profile exactly.`,

    (s, sRole, _w, wDetail) =>
      `The victim had been seen accepting food from ${s} — ${sRole} — just hours before the body was found slumped over a corner table in the otherwise deserted dining hall. Investigators noted that the victim's cup still held liquid, and traces found on the rim were later confirmed to contain a foreign substance. ${wDetail} was found beneath the victim's chair, and fingerprint evidence on the food counter pointed directly back to ${s}'s usual station. The security footage from inside the kitchen showed ${s} alone at the serving area for eleven uninterrupted minutes that evening.`,
  ],

  central_field: [
    (s, sRole, _w, wDetail) =>
      `After dark, the central field of KUET belongs to no one — or so it feels. The broken floodlight on the east side has been reported for months and never repaired, leaving a long diagonal shadow across the south half of the pitch. ${s} — ${sRole} — used that shadow deliberately. Three students returning from the library saw a figure standing motionless near the southern goalpost. By the time they crossed the footpath, the figure was gone. The body was found at dawn, half-hidden behind the groundskeeper's shed. ${wDetail} was buried just beneath the loose soil at the field's edge, close enough to the shed that it would not have been found without a careful search.`,

    (s, sRole, _w, wDetail) =>
      `The inter-department football tournament had left lingering grudges, and ${s} — ${sRole} — was at the centre of one of them. A referee's disputed call, an accusation of cheating, and a public argument that spilled into the evening: everyone who witnessed it agreed that ${s} had been the more threatening party. Campus security confirmed that ${s} had re-entered the field enclosure after the main gates were locked, squeezing through a gap in the perimeter fence near the north-west corner. ${wDetail} was recovered from inside the groundskeeper's shed, resting on top of a stack of dusty equipment bags. A blood-stained cloth was found discarded two metres away.`,

    (s, sRole, _w, wDetail) =>
      `A couple sitting on the bleachers that evening recalled seeing a figure — who a nearby lamp briefly illuminated as ${s}, ${sRole} — standing at the far end of the field for over twenty minutes without moving. When they left, ${s} was still there. Thirty minutes later, the lamp they had been sitting near went dark — bulb deliberately removed, investigators later confirmed. The body was found the next morning at the centre circle, feet pointing toward the goalpost. ${wDetail} had been wiped down with grass and partially buried near the penalty spot. ${s}'s boot prints in the mud matched the tread recovered from the scene.`,
  ],

  it_park: [
    (s, sRole, _w, wDetail) =>
      `The IT Park computer lab logs every entry and exit — or it's supposed to. ${s} — ${sRole} — had requested extended access that evening, citing a final year project submission. The faculty-in-charge approved without question. At 2:14 AM, a maintenance technician doing a routine server check discovered that the emergency exit had been propped open and the body was slumped beside a terminal in the far corner of the lab. ${wDetail} was wedged behind the server rack enclosure, still warm from proximity to the processors. The CCTV hard drive had been removed — but a secondary camera in the server room corridor had captured ${s} passing its lens at 12:51 AM, twenty minutes after the lab was supposed to be empty.`,

    (s, sRole, _w, wDetail) =>
      `Something in the server room had been disturbed — the cooling fan settings manually overridden, a network cable unplugged, and the room's keycard log showing an access entry at 1:03 AM that matched ${s}'s credentials. ${s} — ${sRole} — had no scheduled access for that time. The system administrator noticed the anomaly when she arrived at 7:15 AM to find the server room temperature three degrees above threshold. Inside, a monitor had been knocked face-down onto a desk, and ${wDetail} was found coiled between the back of the network switch cabinet and the wall. The victim had been working late that same night — alone, in the lab, on a project that ${s} had strong reasons to suppress.`,

    (s, sRole, _w, wDetail) =>
      `${s} — ${sRole} — had a habit of occupying the same corner workstation in the IT Park lab night after night. Other students had noticed but said nothing. On the night of the murder, a fellow researcher returned at midnight to retrieve a forgotten storage drive and found the lab eerily silent — chairs overturned, a workstation displaying a frozen screen, and the fire exit door ajar. ${wDetail} was tangled beneath a dense knot of ethernet cables running between two rows of desks. A partial fingerprint on the mouse of the adjacent terminal was later matched to ${s}. They had no explanation for their presence in the lab after the officially recorded sign-out time.`,
  ],

  begum_rokeya: [
    (s, sRole, _w, wDetail) =>
      `Access to Begum Rokeya Hall after visiting hours requires a specific entry code and prior registration. ${s} — ${sRole} — had neither. And yet, a second-floor resident clearly recalled seeing ${s} in the corridor outside the shared bathroom at 11:15 PM, moving quickly and without speaking. By midnight, the victim had not returned to her room. By morning, the hall warden had filed a report. ${wDetail} was recovered from beneath the wardrobe in room 214, tucked behind a suitcase. The victim's vanity mirror had been turned face-down — a detail that investigators found deliberately staged.`,

    (s, sRole, _w, wDetail) =>
      `The victim had confided in her roommate that she felt she was being followed on campus. She had seen ${s} — ${sRole} — near the hall entrance three times in four days, always at dusk, always moving away when noticed. On the night she disappeared, the hall's visitor log showed a false entry — a name that did not match any registered contact. Security footage from the external corridor showed the silhouette of someone matching ${s}'s build entering through a ground-floor fire exit that had been wedged open. ${wDetail} was found inside a laundry bag in the common room. ${s}'s movements that entire evening remain unaccounted for.`,

    (s, sRole, _w, wDetail) =>
      `A power cut struck Begum Rokeya Hall at 10:44 PM — brief, eighteen minutes, but enough. ${s} — ${sRole} — had been seen entering the adjacent administrative building shortly before it. A resident heard a voice she recognised as ${s}'s in the darkened stairwell during the blackout. When the lights returned at 11:02 PM, a scream from the second floor corridor drew the warden and two residents. The victim had been found. ${wDetail} was discovered inside a laundry bundle near the shared bathroom, beneath two layers of folded uniforms. ${s}'s partial handprint on the corridor railing could not be explained by any legitimate visit.`,
  ],

  lotus_pond: [
    (s, sRole, _w, wDetail) =>
      `The lotus pond is one of the few places on campus where you can be completely alone after dark. The lamppost light barely reaches the far edges, and the willows at the south corner drape far enough into the water to conceal a person standing still. ${s} — ${sRole} — had told classmates they planned to meet someone there that night. They refused to say who. When a student walking the outer path heard a sharp cry at 11:30 PM and a splash, they hesitated. By the time help arrived, the body had drifted among the lily pads near the stone walkway. ${wDetail} was found at the water's edge near the lamppost, half-submerged, one end lodged in the mud.`,

    (s, sRole, _w, wDetail) =>
      `The narrow stone walkway that bisects the lotus pond was slick with dew that night. The low railings on either side are decorative — not sturdy enough to stop a fall. ${s} — ${sRole} — had been observed walking the path at night on at least three prior occasions, always alone, always after eleven. A security guard had noted it and done nothing. On the night of the murder, the lamppost at the centre of the walkway flickered and went out at 11:18 PM — investigators later confirmed the bulb had been loosened, not failed. The body was found floating just past the stone bench on the east bank. ${wDetail} was recovered from behind that same bench, pressed flat against the wall with a stone placed deliberately on top.`,

    (s, sRole, _w, wDetail) =>
      `The lotus pond is enclosed by low stone walls on three sides and a boundary fence on the fourth. There are only two ways in. ${s} — ${sRole} — had used both. Campus records showed ${s}'s keycard activating the east gate at 10:58 PM. The western gate was found unlatched the following morning — forced from inside, investigators concluded. The victim's belongings were found on the stone bench: bag, jacket, phone — everything still there, as though they expected to return. ${wDetail} was found in the shallow water near the north opening, retrieved by the drain inspection crew. A torn piece of cloth snagged on the railing beside it matched the lining of ${s}'s jacket.`,
  ],

  pocket_gate: [
    (s, sRole, _w, wDetail) =>
      `The pocket gate is the smallest of KUET's three entry points — one guard booth, one barrier, one CCTV camera that had been flagged as malfunctioning for fourteen days. The duty guard had stepped away for ten minutes — a routine he repeated every night, always at the same time, a fact that ${s} — ${sRole} — knew well. The tea stall vendor nearby told investigators she had seen ${s} standing near the barrier just before the guard stepped away, as though timing it. When the guard returned, the logbook bore a fresh smear across the last entry. ${wDetail} was found propped against the barrier post inside the gate, partially covered by the fallen logbook. ${s} was the last name reliably recorded entering the campus that night.`,

    (s, sRole, _w, wDetail) =>
      `The shops around the pocket gate close by midnight, but the last few customers linger over tea. ${s} — ${sRole} — was one of them. The tea stall vendor confirmed that ${s} had been sitting at the low bench outside the stall for over forty minutes, barely touching the cup, watching the gate. When the campus road behind the barrier went dark — the overhead light cutting out at 12:06 AM, as it often does — ${s} moved. The body was found the next morning in the narrow strip of road between the barrier and the first campus building. ${wDetail} was recovered from inside the guard booth itself, tucked beneath the duty logbook as though it belonged there.`,

    (s, sRole, _w, wDetail) =>
      `Every entry through the pocket gate is supposed to be logged by hand and confirmed by the guard. That night, one entry was deliberately smudged — but forensic recovery restored the name: ${s}, ${sRole}. The entry time was 12:06 AM. The exit entry was missing entirely. In the forty-five minutes between entry and when the guard woke from his unexpected drowsiness — later attributed to something dissolved into his thermos — the campus boundary had been used as a killing ground. ${wDetail} was found inside the nearer gate pillar's hollow base, wrapped carefully in newspaper. The wrapping bore a partial ink transfer from the campus noticeboard near the shopkeeper's stall, placing it in ${s}'s territory before the crime.`,
  ],
}

export function generateStory(suspectId: string, weaponId: string, locationId: string): string {
  const suspect  = BY_ID[suspectId]
  const weapon   = BY_ID[weaponId]

  const sName   = suspect?.name  ?? suspectId
  const wName   = weapon?.name   ?? weaponId
  const sRole   = SUSPECT_ROLE[suspectId]   ?? sName
  const wDetail = WEAPON_DETAIL[weaponId]   ?? wName

  // Map location card ID → location story key
  const locationKey = locationId.replace('student_welfare', 'student_welfare')

  const templates = LOCATION_STORIES[locationKey]
  if (!templates || templates.length === 0) {
    return `${sName} was found near the scene. The ${wName} left behind told its own story.`
  }

  const idx = Math.floor(Math.random() * templates.length)
  return templates[idx](sName, sRole, wName, wDetail)
}
