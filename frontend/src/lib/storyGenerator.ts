import { ALL_CARDS } from '../types'

const BY_ID = Object.fromEntries(ALL_CARDS.map(c => [c.id, c]))

const SUSPECT_ROLE: Record<string, string> = {
  chef:           'the campus chef, who moved freely between the kitchen, the serving counter, and the back corridors at all hours',
  hallboy:        'the hall attendant, whose master keys and errand routes gave access to every room and corridor',
  security_guard: 'the security guard on duty, whose patrol schedule and gate keys made them uniquely invisible to suspicion',
  shopkeeper:     'the campus shopkeeper, whose stall near the main routes let them watch, wait, and move without drawing attention',
  student_girl:   'a third-year student who had been seen in places she had no reason to be in the days before the incident',
  student_boy:    'a second-year student, restless, argumentative, and known to push limits well past midnight',
}

const WEAPON_DETAIL: Record<string, string> = {
  knife:          'a kitchen knife sharpened recently and wiped clean, but not clean enough',
  sleeping_pills: 'a dissolved dose of sleeping pills slipped into an unattended drink, odourless and colourless until the autopsy',
  revolver:       'a revolver fired once at close range, the sound muffled by the thick walls and the hour',
  laptop_charger: 'a laptop charger used as a cord, looped and pulled tight before anyone could react',
  anti_cutter:    'an anti-cutter drawn from a front pocket and used with one practiced motion',
  rope:           'a length of rope hidden inside a bag for days, waiting for the right moment',
}

type StoryFn = (s: string, _sRole: string, _w: string, wDetail: string) => string

const LOCATION_STORIES: Record<string, StoryFn[]> = {

  auditorium: [
    (s, _sRole, _w, wDetail) =>
      `The auditorium was supposed to be locked after the evening programme. ${s} had slipped back inside using the stage left entrance before the caretaker turned the deadbolt. A student arriving for morning rehearsals found the stage lights still burning and a body across the front row. ${wDetail} was found tucked under a seat cushion. ${s} could not explain their presence.`,

    (s, _sRole, _w, wDetail) =>
      `The auditorium held only two people that night. ${s} stayed behind after the convocation rehearsal, claiming to have forgotten something in the sound booth. The caretaker left without question. By morning a body lay beneath the stage rigging. ${wDetail} was recovered from behind the curtain rail. CCTV placed ${s} inside the building for over two hours.`,

    (s, _sRole, _w, wDetail) =>
      `A scraping sound, then silence, then quick footsteps near the auditorium just after eleven. ${s} appeared on three separate camera feeds that night, each time closer to the entrance. Stage curtains were disturbed and seats displaced. ${wDetail} was found behind the emergency exit. The theatre logbook confirmed ${s} had entered that evening and never signed out.`,
  ],

  student_welfare: [
    (s, _sRole, _w, wDetail) =>
      `The Student Welfare Centre's back office holds the most sensitive files on campus. ${s} had visited twice that week on the pretext of personal sessions. When the duty officer stepped away for fifteen minutes, the back room was ransacked. The victim was found at the reception desk. ${wDetail} was inside the filing cabinet, wrapped in a transcript bearing ${s}'s name.`,

    (s, _sRole, _w, wDetail) =>
      `Staff recalled ${s} being agitated at a recent session, refusing to leave when it ended. A janitor spotted ${s} near the side entrance at 10:52 PM. The counselling room camera had been unplugged. ${wDetail} was found under the waiting bench. ${s}'s keycard was the last one logged on the system before the victim was discovered.`,

    (s, _sRole, _w, wDetail) =>
      `The victim had grown anxious, telling friends she had seen something at the welfare centre she should not have. ${s} had been reviewing files not belonging to them during off-hour access. The front door log recorded a successful entry at 11:34 PM. ${wDetail} was found behind the noticeboard. ${s}'s card was the last entry logged that night.`,
  ],

  amar_ekushey: [
    (s, _sRole, _w, wDetail) =>
      `Residents of Amar Ekushey Hall rarely questioned a familiar face, and ${s} was exactly that. The victim had returned late after a dispute that several bunkmates overheard. By morning the victim was simply gone. ${wDetail} was tucked beneath the neighbouring mattress, and ${s}'s fingerprints were on the footlocker beside it.`,

    (s, _sRole, _w, wDetail) =>
      `The second floor corridor of Amar Ekushey Hall loses power at midnight. Three residents heard a muffled confrontation around 12:20 AM and did not investigate. Drag marks were found near the communal bathroom the next morning. ${wDetail} was recovered from behind the wash basin pipes inside a cloth bag marked with ${s}'s initials.`,

    (s, _sRole, _w, wDetail) =>
      `${s} had entered the dormitory three times in a single evening, each visit shorter than the last, as though testing something. The visitor register showed the final entry at 11:47 PM. The duty boy confirmed ${s} was still inside after the building locked. The victim's desk had been overturned. ${wDetail} was lodged behind it beside cloth matching ${s}'s attire.`,
  ],

  cafeteria: [
    (s, _sRole, _w, wDetail) =>
      `After the cafeteria closed, the back rooms belonged to whoever held a key. ${s} held one and had signed in at 9:43 PM with no record of leaving. The victim had stayed behind to speak with someone. A pot was overturned on the burner, trays knocked to the floor. ${wDetail} was found behind the refrigerator at the end of the kitchen.`,

    (s, _sRole, _w, wDetail) =>
      `${s} was always at the margins of the cafeteria, watching the room. The closing trainee saw them linger past shuttering time. By morning footprints led from the cold storage room to the emergency exit. ${wDetail} was inside the waste bin behind the cooking station, wrapped in a catering apron. A knife was missing from the rack near ${s}'s usual station.`,

    (s, _sRole, _w, wDetail) =>
      `The victim had accepted food from ${s} just hours before being found slumped at a corner table. The victim's cup still held liquid, later confirmed to contain a foreign substance. ${wDetail} was found beneath the chair. Fingerprint evidence from the food counter pointed directly back to ${s}'s station. Security footage showed ${s} alone at the serving area for eleven uninterrupted minutes.`,
  ],

  central_field: [
    (s, _sRole, _w, wDetail) =>
      `A broken floodlight left a long shadow across the south half of the central field. ${s} used that shadow deliberately. Three students crossing the footpath saw a figure near the south goalpost that evening; when they passed, the figure was gone. The body was found at dawn behind the groundskeeper's shed. ${wDetail} was buried just beneath the soil at the field's edge.`,

    (s, _sRole, _w, wDetail) =>
      `After a disputed referee call and a public argument during the inter-department tournament, ${s} had been the more threatening party. Security confirmed ${s} re-entered the field after the gates were locked, squeezing through a gap in the perimeter fence. ${wDetail} was recovered from inside the groundskeeper's shed. A blood-stained cloth was found discarded two metres away.`,

    (s, _sRole, _w, wDetail) =>
      `A couple on the bleachers watched ${s} stand motionless at the far end of the field for over twenty minutes. After they left, the nearby lamp went dark. Investigators confirmed the bulb had been deliberately removed, not failed. The body was found the next morning at the centre circle. ${wDetail} was partially buried near the penalty spot, wiped down with grass.`,
  ],

  it_park: [
    (s, _sRole, _w, wDetail) =>
      `${s} had requested extended lab access that evening, citing a final year project. At 2:14 AM a maintenance technician found the emergency exit propped open and the victim slumped at a terminal in the far corner. ${wDetail} was wedged behind the server rack. The CCTV hard drive had been removed, but a secondary camera caught ${s} passing its lens at 12:51 AM.`,

    (s, _sRole, _w, wDetail) =>
      `The server room's cooling fans had been manually overridden and a network cable unplugged. The keycard log showed an entry at 1:03 AM matching ${s}'s credentials, with no scheduled access for that time. A monitor was face-down on a desk. ${wDetail} was found between the network cabinet and the wall. The victim had been working in the lab alone that night.`,

    (s, _sRole, _w, wDetail) =>
      `${s} occupied the same corner workstation in the IT Park lab night after night. A colleague returning at midnight found chairs overturned, a screen frozen, and the fire exit ajar. ${wDetail} was tangled beneath a dense knot of ethernet cables between two rows of desks. A fingerprint on the adjacent mouse was later matched to ${s}, who had no explanation for their presence.`,
  ],

  begum_rokeya: [
    (s, _sRole, _w, wDetail) =>
      `Access to Begum Rokeya Hall after visiting hours requires a specific entry code. ${s} had neither code nor registration, yet a second-floor resident clearly saw them in the corridor at 11:15 PM, moving quickly and without speaking. By morning the victim had not returned to her room. ${wDetail} was found beneath a wardrobe in room 214. The victim's mirror had been turned face-down.`,

    (s, _sRole, _w, wDetail) =>
      `The victim had told her roommate she felt followed, having noticed ${s} near the hall entrance three times in four days, always at dusk. The night she disappeared, the visitor log showed a false entry. Footage showed a silhouette matching ${s}'s build using a ground-floor fire exit that had been wedged open. ${wDetail} was found inside a laundry bag in the common room.`,

    (s, _sRole, _w, wDetail) =>
      `A power cut struck Begum Rokeya Hall at 10:44 PM and lasted eighteen minutes. ${s} had been seen entering the adjacent building just before it. A resident heard a familiar voice in the darkened stairwell during the blackout. When the lights returned a scream from the second floor followed. ${wDetail} was inside a laundry bundle near the shared bathroom. ${s}'s handprint was on the corridor railing.`,
  ],

  lotus_pond: [
    (s, _sRole, _w, wDetail) =>
      `The lotus pond offers solitude after dark. ${s} had told classmates they planned to meet someone there that night, refusing to say who. A student walking the outer path heard a sharp cry at 11:30 PM. The body was found drifting near the stone walkway. ${wDetail} was half-submerged at the water's edge, one end lodged in the mud near the lamppost.`,

    (s, _sRole, _w, wDetail) =>
      `The stone walkway through the lotus pond was slick with dew that night. ${s} had been seen walking it alone after eleven on several prior occasions. The central lamppost went out at 11:18 PM; investigators confirmed the bulb had been deliberately loosened. The body was found near the east bank bench. ${wDetail} was pressed flat behind the bench, held down by a stone.`,

    (s, _sRole, _w, wDetail) =>
      `Only two gates lead into the lotus pond enclosure. Campus records showed ${s}'s keycard activating the east gate at 10:58 PM. The western gate was found unlatched the next morning, forced from inside. The victim's bag, jacket, and phone were left on the stone bench untouched, as though they expected to return. ${wDetail} was recovered from the shallow water near the north opening.`,
  ],

  pocket_gate: [
    (s, _sRole, _w, wDetail) =>
      `The pocket gate's CCTV had been flagged as broken for two weeks. The duty guard stepped away at the same time each night, a routine ${s} knew well. The tea stall vendor saw ${s} standing near the barrier just before the guard left, as though timing it. When the guard returned, the logbook bore a fresh smear. ${wDetail} was propped against the barrier post inside the gate.`,

    (s, _sRole, _w, wDetail) =>
      `${s} had sat at the tea stall beside the pocket gate for over forty minutes, barely touching their cup, watching the barrier. When the overhead light cut out at 12:06 AM, ${s} moved. The body was found between the barrier and the first campus building the next morning. ${wDetail} was tucked beneath the duty logbook inside the guard booth.`,

    (s, _sRole, _w, wDetail) =>
      `Each entry through the pocket gate is hand-logged and confirmed by the guard. That night, one entry was deliberately smudged. Forensic recovery restored the name: ${s}. The entry time was 12:06 AM with no exit recorded. The guard was found incapacitated, his thermos later confirmed to have been tampered with. ${wDetail} was inside the hollow base of the gate pillar, wrapped in newspaper.`,
  ],
}

export function generateStory(suspectId: string, weaponId: string, locationId: string): string {
  const suspect  = BY_ID[suspectId]
  const weapon   = BY_ID[weaponId]

  const sName   = suspect?.name ?? suspectId
  const wName   = weapon?.name  ?? weaponId
  const sRole   = SUSPECT_ROLE[suspectId] ?? sName
  const wDetail = WEAPON_DETAIL[weaponId] ?? wName

  const templates = LOCATION_STORIES[locationId]
  if (!templates || templates.length === 0) {
    return `${sName} was found near the scene. The ${wName} left behind told its own story.`
  }

  const idx = Math.floor(Math.random() * templates.length)
  return templates[idx](sName, sRole, wName, wDetail)
}
