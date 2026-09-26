'use strict';

export const WEIGHT_STEP = 2.5;
export const RIR_BY_WEEK = ['3 RIR', '3 RIR', '2–3 RIR', '2 RIR', '2 RIR', '1–2 RIR', '1–2 RIR', 'Deload'];
export const FEEL_LABELS = { easy: '😴 too easy', right: '💪 just right', hard: '🥵 too hard' };

/* ================= exercise library =================
   One entry per movement. `equip` tags drive equipment-preference
   selection and swap ordering; `alts` are same-muscle swaps for when
   a machine is taken. Programs reference entries by key. */
export const LIB = {
  /* ---------- lower body ---------- */
  backSquat: {
    name: 'Back squat', muscle: 'Quads (rectus femoris)', equip: 'barbell', media: 'Barbell_Squat',
    video: 'barbell back squat proper form', videoF: 'how to barbell back squat tutorial abby pollock',
    videoId: 'uEH8EqCHnFA', videoIdF: 'RGTn5S06T54',
    cue: 'Deep as mobility allows, heels down',
    alts: ['frontSquat', 'gobletSquat', 'legPress', 'hackSquat'],
    form: [
      'Feet shoulder-width, toes pointed slightly out',
      'Big breath in, brace your abs like someone’s about to poke them',
      'Sit down between your heels — as deep as feels comfortable',
      'Heels stay glued to the floor, knees track over your toes',
      'Chest up the whole way; drive up and breathe out at the top',
    ],
  },
  frontSquat: {
    name: 'Front squat', muscle: 'Quads (rectus femoris)', equip: 'barbell', media: 'Front_Barbell_Squat',
    video: 'front squat proper form',
    cue: 'Elbows high, upright torso',
    alts: ['backSquat', 'hackSquat', 'legPress'],
    form: [
      'Bar across the front delts, elbows pointed high',
      'Stay upright — chest and elbows up the whole way',
      'Sit straight down between your heels, heels flat',
      'Drive up keeping the torso vertical',
    ],
  },
  gobletSquat: {
    name: 'Goblet squat', muscle: 'Quads (rectus femoris)', equip: 'dumbbell', media: 'Goblet_Squat',
    video: 'goblet squat proper form', videoF: 'goblet squat form tutorial redefining strength',
    videoId: 'MeIiIdhvXT4', videoIdF: 'XVi1CmVvPGw',
    cue: 'Dumbbell tight to your chest',
    alts: ['backSquat', 'legPress', 'hackSquat'],
    form: [
      'Hold one dumbbell vertically against your chest with both hands',
      'Feet shoulder-width, toes slightly out',
      'Sit straight down between your heels, elbows inside your knees',
      'Heels down, chest up the whole way',
      'Stand up by pushing the floor away',
    ],
  },
  hipThrust: {
    name: 'Hip thrust', muscle: 'Glutes (max)', equip: 'barbell', media: 'Barbell_Hip_Thrust',
    video: 'hip thrust proper form', videoF: 'hip thrust form tutorial liftinglindsay',
    videoId: 'SEdqd1n0cvg', videoIdF: 'cjeWbow5uWo',
    cue: '1–2 s squeeze at top, chin tucked',
    alts: ['gluteBridge', 'gluteKickback'],
    form: [
      'Upper back on the bench, bar over your hips (always use the pad)',
      'Feet hip-width; at the top your shins should be vertical',
      'Chin tucked, ribs down — eyes forward, not at the ceiling',
      'Push through your heels and squeeze your glutes hard at the top for 1–2 s',
      'Full hip lockout from the glutes — don’t arch your lower back',
    ],
  },
  gluteBridge: {
    name: 'Glute bridge', muscle: 'Glutes (max)', equip: 'barbell', media: 'Barbell_Glute_Bridge',
    video: 'barbell glute bridge proper form', videoF: 'barbell glute bridge tutorial liftinglindsay',
    videoId: '0od5lwWMGV8', videoIdF: 'bKq6BefG-RA',
    cue: 'Hips up hard, squeeze at top',
    alts: ['hipThrust', 'gluteKickback'],
    form: [
      'Lie on your back, knees bent, feet flat near your hips',
      'Bar or dumbbell over your hips (use a pad)',
      'Drive through your heels and lift your hips to a straight line',
      'Squeeze your glutes 1–2 s at the top',
      'Lower with control — don’t bounce off the floor',
    ],
  },
  gluteKickback: {
    name: 'Glute kickback', muscle: 'Glutes (max)', equip: 'cable', media: 'Glute_Kickback',
    video: 'glute kickback proper form', videoF: 'glute kickback form tutorial liftinglindsay',
    videoId: 'l4zReIOfPCQ', videoIdF: 'bVrmtCI00Ys',
    cue: 'Squeeze at full extension',
    alts: ['hipThrust', 'gluteBridge'],
    form: [
      'Set the cable or pad just above your ankle, or under your foot',
      'Hinge slightly forward and hold the frame',
      'Kick straight back and slightly up, squeezing the glute',
      'Pause at full extension, return with control',
    ],
  },
  legExtension: {
    name: 'Leg extension', muscle: 'Quads (rectus femoris)', equip: 'machine', media: 'Leg_Extensions',
    video: 'leg extension machine proper form', videoF: 'leg extension form tutorial liftinglindsay',
    videoId: 'o90ocSBDJis', videoIdF: '3pOsjZGe10k',
    cue: 'Control the lowering, squeeze at top',
    alts: ['legPress', 'hackSquat'],
    form: [
      'Adjust the seat so your knees line up with the machine’s pivot point',
      'Pad sits on your lower shins; back flat against the seat',
      'Kick up until your legs are straight, squeeze the quads at the top',
      'Lower slowly (2–3 s) — no swinging, no letting the stack drop',
    ],
  },
  seatedLegCurl: {
    name: 'Seated leg curl', muscle: 'Hamstrings (short head)', equip: 'machine', media: 'Seated_Leg_Curl',
    video: 'seated leg curl proper form', videoF: 'seated leg curl form tutorial liftinglindsay',
    videoId: 'oFxEDkppbSQ', videoIdF: 'Y-MBx5qmTk8',
    cue: 'Squeeze at the bottom',
    alts: ['lyingLegCurl', 'rdl'],
    form: [
      'Knees lined up with the pivot, thigh pad snug on your legs',
      'Curl your heels down and back as far as they’ll go',
      'Squeeze the hamstrings briefly at the bottom',
      'Return slowly — don’t let the weight stack slam',
    ],
  },
  lyingLegCurl: {
    name: 'Lying leg curl', muscle: 'Hamstrings (short head)', equip: 'machine', media: 'Lying_Leg_Curls',
    video: 'lying leg curl proper form', videoF: 'lying leg curl form tutorial liftinglindsay',
    videoId: 'P7-RxTVe6O0', videoIdF: 'vl5nUdE9mWM',
    cue: 'Hips stay down on the pad',
    alts: ['seatedLegCurl', 'rdl'],
    form: [
      'Pad on your lower calves, knees just off the edge of the bench',
      'Keep your hips pressed into the bench the whole set',
      'Curl your heels toward your glutes',
      'Lower slowly — no slamming',
    ],
  },
  standingCalf: {
    name: 'Standing calf raise', muscle: 'Calves (gastrocnemius)', equip: 'machine', media: 'Standing_Calf_Raises',
    video: 'standing calf raise proper form', videoF: 'standing calf raise tutorial liftinglindsay',
    videoId: 'YMmgqO8Jo-k', videoIdF: 'SorIB5_zO9A',
    cue: '1–2 s pause in deep stretch at bottom',
    // calf press is the true match (knee straight = gastrocnemius); seated
    // is soleus and only a last-resort substitute
    alts: ['calfPress', 'seatedCalf'],
    form: [
      'Balls of your feet on the edge, heels hanging free',
      'Press up as high as you can and pause 1 s at the top',
      'Lower into a deep stretch and hold it 1–2 s — this is the important part',
      'Knees straight but not locked; never bounce',
    ],
  },
  seatedCalf: {
    name: 'Seated calf raise', muscle: 'Calves (soleus)', equip: 'machine', media: 'Seated_Calf_Raise',
    video: 'seated calf raise proper form', videoF: 'seated calf raise tutorial liftinglindsay',
    videoId: 'pz66Bw6HJ4s', videoIdF: 'ORY-ke6vcgk',
    cue: 'Pause in the stretch',
    alts: ['standingCalf', 'calfPress'],
    form: [
      'Pads on your lower thighs, balls of your feet on the platform',
      'Press up onto your toes and pause at the top',
      'Sink your heels into a deep stretch and hold 1–2 s',
      'Slow and controlled — no bouncing',
    ],
  },
  calfPress: {
    name: 'Calf press (leg press)', muscle: 'Calves (gastrocnemius)', equip: 'machine', media: 'Calf_Press_On_The_Leg_Press_Machine',
    video: 'calf press on leg press machine', videoF: 'leg press calf raise tutorial liftinglindsay',
    videoId: 'PYZY00hI43w', videoIdF: 'J2TH-qxq2d4',
    cue: 'Full stretch, full squeeze',
    alts: ['standingCalf', 'seatedCalf'],
    form: [
      'Balls of your feet on the bottom edge of the leg press platform',
      'Legs almost straight, knees soft',
      'Press through your toes as far as you can and pause',
      'Let your heels sink back into a deep stretch and pause',
    ],
  },
  hackSquat: {
    name: 'Hack squat', muscle: 'Quads (rectus femoris)', equip: 'machine', media: 'Hack_Squat',
    video: 'hack squat machine proper form', videoF: 'hack squat form tutorial liftinglindsay',
    videoId: '-lAnEGH2blE', videoIdF: 'QKFR65fLkOM',
    cue: 'Go deep, controlled descent',
    alts: ['legPress', 'backSquat', 'gobletSquat'],
    form: [
      'Back and hips flat against the pad the whole time',
      'Feet around the middle of the platform, shoulder-width',
      'Lower deep and controlled (2–3 s down), knees tracking over toes',
      'Don’t let your hips curl off the pad at the bottom',
      'Press through your whole foot to stand back up',
    ],
  },
  rdl: {
    name: 'Romanian deadlift', muscle: 'Hamstrings & glutes', equip: 'barbell', media: 'Romanian_Deadlift',
    video: 'romanian deadlift proper form', videoF: 'romanian deadlift form tutorial meg gallagher',
    videoId: '_oyxCn2iSjU', videoIdF: '6iJMQhHHxso',
    cue: 'Big stretch at bottom, flat back',
    alts: ['dbRdl', 'seatedLegCurl', 'lyingLegCurl'],
    form: [
      'Soft bend in the knees; bar or dumbbells stay touching your legs',
      'Push your hips straight back — like closing a car door with your butt',
      'Back stays flat, shoulders back, chest proud',
      'Lower until you feel a big stretch in the hamstrings (around mid-shin)',
      'Stand up by squeezing your glutes — don’t pull with your lower back',
    ],
  },
  dbRdl: {
    name: 'Dumbbell RDL', muscle: 'Hamstrings & glutes', equip: 'dumbbell', media: 'Romanian_Deadlift',
    video: 'dumbbell romanian deadlift proper form', videoF: 'dumbbell rdl form tutorial liftinglindsay',
    videoId: 'aa57T45iFSE', videoIdF: '68DCrZYEtus',
    cue: 'Same hinge, dumbbells stay close',
    alts: ['rdl', 'seatedLegCurl', 'lyingLegCurl'],
    form: [
      'Dumbbells resting against the front of your thighs',
      'Soft knees; push your hips straight back',
      'Dumbbells slide down your legs — keep them touching',
      'Big hamstring stretch around mid-shin, flat back',
      'Squeeze your glutes to stand back up',
    ],
  },
  lunge: {
    name: 'Dumbbell lunge', muscle: 'Quads & glutes', equip: 'dumbbell', media: 'Dumbbell_Lunges',
    video: 'dumbbell lunge proper form', videoF: 'dumbbell lunge form glutes tutorial',
    videoId: '_DLIS8SySzs', videoIdF: 'V7OmlotAh6g',
    cue: 'Long step = more glutes',
    alts: ['legPress', 'gobletSquat', 'hackSquat'],
    form: [
      'Dumbbells at your sides, take a long step forward',
      'Lower the back knee toward the floor, torso leaning slightly forward',
      'Front heel stays down; knee tracks over your toes',
      'Push through the front foot to stand back up',
    ],
  },
  hipAbduction: {
    name: 'Hip abduction', muscle: 'Glutes (medius)', equip: 'machine', media: 'Thigh_Abductor',
    video: 'hip abduction machine proper form', videoF: 'hip abduction machine form liftinglindsay',
    videoId: 'afpCTlFdyl8', videoIdF: 'OQC8nso2aPE',
    cue: 'Lean torso slightly forward',
    alts: ['gluteKickback'],
    form: [
      'Lean your torso slightly forward and hold the handles — this targets the upper glutes better',
      'Push your knees out wide, smooth and controlled',
      'Pause briefly at the widest point',
      'Resist on the way back in — don’t let the pads snap together',
    ],
  },
  hipAdduction: {
    name: 'Hip adduction', muscle: 'Inner thighs', equip: 'machine', media: 'Thigh_Adductor',
    video: 'hip adduction machine proper form', videoF: 'hip adduction machine form liftinglindsay',
    videoId: 'ScqpbvOZWe8', videoIdF: 'CjAVezAggkI',
    cue: 'Full stretch at the open position',
    alts: ['cableHipAdduction'],
    form: [
      'Start with your legs open at a comfortable stretch — not painful',
      'Squeeze your knees together smoothly',
      'Hold the squeeze for a beat at the middle',
      'Open back up slowly, resisting the whole way',
    ],
  },
  cableHipAdduction: {
    name: 'Cable hip adduction', muscle: 'Inner thighs', equip: 'cable', media: 'Cable_Hip_Adduction',
    video: 'cable hip adduction proper form', videoF: 'cable hip adduction form liftinglindsay',
    cue: 'Slow and controlled',
    alts: ['hipAdduction'],
    form: [
      'Cuff around your ankle, stand side-on to the cable',
      'Sweep your working leg across your body',
      'Squeeze your inner thigh at the end of the sweep',
      'Resist on the way back out',
    ],
  },
  legPress: {
    name: 'Leg press', muscle: 'Quads & glutes', equip: 'machine', media: 'Leg_Press',
    video: 'leg press proper form', videoF: 'leg press for glutes form tutorial',
    videoId: 'jKtLmn69ahk', videoIdF: 'M_xoJ0iRLFc',
    cue: 'Full depth, no lower-back rounding',
    alts: ['hackSquat', 'backSquat', 'gobletSquat', 'lunge'],
    form: [
      'Feet high on the platform and wide, toes pointed slightly out',
      'Lower slow and deep, knees coming toward your armpits',
      'Stop just before your lower back starts to round off the pad',
      'Press through your heels; don’t slam your knees straight at the top',
    ],
  },
  hipFlexedLegExt: {
    name: 'Leg extension (hip-flexed)', muscle: 'Quads (rectus femoris)', equip: 'machine',
    video: 'leg extension lean back rectus femoris form',
    cue: 'Lean back ~40°, extend to lockout',
    alts: ['sissySquat', 'declineSquat'],
    form: [
      'Set up on the leg extension but lean your torso back ~40°',
      'The hip-flexed position lets the rectus femoris actually work',
      'Extend to full lockout, squeeze the quad',
      'Lower slowly; this beats the upright seated version for the RF',
    ],
  },
  sissySquat: {
    name: 'Sissy squat', muscle: 'Quads (rectus femoris)', equip: 'body',
    video: 'sissy squat rectus femoris form',
    cue: 'Knees travel forward, lean back',
    alts: ['hipFlexedLegExt', 'declineSquat'],
    form: [
      'Hold a support, rise onto the balls of your feet',
      'Let your knees travel forward and lean your torso back',
      'Lower until you feel a deep quad stretch, hips extended',
      'Drive back up; add a plate held to your chest to load it',
    ],
  },
  declineSquat: {
    name: 'Decline (heel-elevated) squat', muscle: 'Quads (rectus femoris)', equip: 'dumbbell',
    video: 'heel elevated goblet squat quad form',
    cue: 'Heels on a wedge, upright torso',
    alts: ['hipFlexedLegExt', 'sissySquat'],
    form: [
      'Elevate your heels on a wedge or small plates, hold a dumbbell',
      'Squat straight down with an upright torso, knees travelling forward',
      'The forward knee travel maximises quad demand',
      'Drive up through the mid-foot',
    ],
  },
  pendulumSquat: {
    name: 'Pendulum squat', muscle: 'Quads (vastus lateralis)', equip: 'machine',
    video: 'pendulum squat quad form',
    cue: 'Deep knee bend, back supported',
    alts: ['narrowLegPress'],
    form: [
      'Back and shoulders on the pad, feet on the platform',
      'Lower deep through an arc — easy on the knees',
      'Drive up without locking the knees harshly',
      'Control the tension between quads and glutes with foot height',
    ],
  },
  narrowLegPress: {
    name: 'Leg press (narrow stance)', muscle: 'Quads (vastus lateralis)', equip: 'machine',
    video: 'narrow stance leg press quad sweep form',
    cue: 'Feet close and centered, deep ROM',
    alts: ['pendulumSquat'],
    form: [
      'Place your feet close together and centered on the platform',
      'Lower deep and under control',
      'The narrow stance biases the outer quad sweep',
      'Press through the mid-foot; don’t let the back round',
    ],
  },
  legExtPause: {
    name: 'Leg extension (lockout pause)', muscle: 'Quads (vastus medialis)', equip: 'machine',
    video: 'leg extension pause vmo form',
    cue: '1-second squeeze at full lockout',
    alts: ['bulgarianSplitSquat', 'narrowHackSquat'],
    form: [
      'Seated leg extension, extend to full lockout',
      'Hold and squeeze for a full second at the top',
      'The teardrop (VMO) fires hardest at terminal extension',
      'Lower slowly under control',
    ],
  },
  bulgarianSplitSquat: {
    name: 'Bulgarian split squat', muscle: 'Quads & glutes', equip: 'dumbbell',
    video: 'bulgarian split squat glute quad form',
    cue: 'Rear foot up, deep lunge',
    alts: ['lunge', 'legPress', 'reverseLunge', 'hipThrust', 'gluteKickback'],
    form: [
      'Rear foot on a bench, dumbbells at your sides',
      'Lower straight down into a deep lunge — big stretch on the front glute',
      'Lean the torso slightly forward to bias the glute',
      'Drive up through the front heel',
    ],
  },
  reverseLunge: {
    name: 'Reverse lunge', muscle: 'Glutes (max)', equip: 'dumbbell',
    video: 'reverse lunge glute form',
    cue: 'Step back, sink straight down',
    alts: ['bulgarianSplitSquat', 'hipThrust', 'gluteKickback'],
    form: [
      'Dumbbells at your sides, step one foot back',
      'Sink straight down until the front thigh is about parallel',
      'Lean slightly forward to load the front glute',
      'Drive up through the front heel; alternate legs',
    ],
  },
  narrowHackSquat: {
    name: 'Hack squat (narrow stance)', muscle: 'Quads (vastus medialis)', equip: 'machine',
    video: 'narrow stance hack squat vmo form',
    cue: 'Knees forward over toes, deep',
    alts: ['legExtPause', 'bulgarianSplitSquat'],
    form: [
      'Narrow foot stance on the hack squat platform',
      'Let the knees travel forward over the toes as you descend deep',
      'Knee-forward path biases the teardrop',
      'Drive up to a soft lockout',
    ],
  },
  singleLegRdl: {
    name: 'Single-leg RDL', muscle: 'Hamstrings & glutes', equip: 'dumbbell',
    video: 'single leg romanian deadlift form',
    cue: 'Hinge on one leg, long spine',
    alts: ['rdl', 'dbRdl', 'hipExtension45'],
    form: [
      'Dumbbell in one or both hands, balance on one leg',
      'Hinge at the hip, free leg extending back as a counterweight',
      'Lower until you feel a deep hamstring stretch, back flat',
      'Drive the hips forward to stand; great unilateral ROM',
    ],
  },
  hipExtension45: {
    name: '45° hip extension', muscle: 'Hamstrings & glutes', equip: 'machine',
    video: '45 degree hip extension hamstring form',
    cue: 'Round the upper back, hinge from hips',
    alts: ['rdl', 'dbRdl', 'singleLegRdl'],
    form: [
      'Pad at your hips on a 45° bench, hold a plate at your chest',
      'Hinge down from the hips for a deep hamstring stretch',
      'Extend up to a straight line, squeezing glutes and hamstrings',
      'Rounding slightly through the upper back keeps tension on the hams',
    ],
  },
  standingLegCurl: {
    name: 'Standing single-leg curl', muscle: 'Hamstrings (short head)', equip: 'machine',
    video: 'standing leg curl form',
    cue: 'Curl the heel to the glute',
    alts: ['seatedLegCurl', 'lyingLegCurl', 'stabilityBallCurl'],
    form: [
      'Brace against the pad, one leg working',
      'Curl your heel up toward your glute',
      'Squeeze the hamstring at the top',
      'Lower slowly to a full stretch; no hip swinging',
    ],
  },
  stabilityBallCurl: {
    name: 'Stability ball leg curl', muscle: 'Hamstrings (short head)', equip: 'body',
    video: 'stability ball leg curl form',
    cue: 'Hips up, roll the ball in',
    alts: ['seatedLegCurl', 'lyingLegCurl', 'standingLegCurl'],
    form: [
      'Lie on your back, heels on a stability ball, hips lifted',
      'Curl the ball toward you by bending the knees',
      'Keep the hips up the whole time',
      'Roll back out slowly under control',
    ],
  },
  nordicCurl: {
    name: 'Nordic hamstring curl', muscle: 'Hamstrings (nordic)', equip: 'body',
    video: 'nordic hamstring curl form',
    cue: 'Lower slowly, fight the fall',
    alts: ['ghr', 'reverseNordic'],
    form: [
      'Kneel with your ankles anchored, body upright',
      'Lower yourself forward as slowly as you can — resist the whole way',
      'Catch with your hands, push back up to assist',
      'Brutal eccentric; also cuts hamstring injury risk',
    ],
  },
  ghr: {
    name: 'Glute-ham raise', muscle: 'Hamstrings (nordic)', equip: 'machine',
    video: 'glute ham raise form',
    cue: 'Hinge and curl in one motion',
    alts: ['nordicCurl', 'reverseNordic'],
    form: [
      'Feet anchored on the GHR pad, body straight',
      'Lower by hinging at the hips, then push the toes down to curl up',
      'Combines hip extension and knee flexion',
      'Easier to control than a full Nordic',
    ],
  },
  reverseNordic: {
    name: 'Inverse / reverse Nordic curl', muscle: 'Hamstrings (nordic)', equip: 'body',
    video: 'assisted nordic curl form',
    cue: 'Partner or band assisted lower',
    alts: ['nordicCurl', 'ghr'],
    form: [
      'Anchor your ankles; have a partner or band assist',
      'Lower forward slowly, fighting the descent',
      'Use the assist to get back up',
      'Same high-eccentric pattern without the GHR machine',
    ],
  },
  standingCableAbduction: {
    name: 'Standing cable hip abduction', muscle: 'Glutes (medius)', equip: 'cable',
    video: 'standing cable hip abduction glute medius form',
    cue: 'Cuff on the ankle, lift out to the side',
    alts: ['hipAbduction', 'sideLyingAbduction', 'bandWalk'],
    form: [
      'Ankle cuff on a low pulley, stand side-on',
      'Lift the working leg out to the side against the cable',
      'Keep your torso upright — no leaning',
      'Control both directions; constant tension throughout',
    ],
  },
  sideLyingAbduction: {
    name: 'Side-lying hip abduction', muscle: 'Glutes (medius)', equip: 'dumbbell',
    video: 'side lying hip abduction form',
    cue: 'Lie on your side, raise the top leg',
    alts: ['hipAbduction', 'standingCableAbduction', 'bandWalk'],
    form: [
      'Lie on your side, optionally a light plate on the top thigh',
      'Raise the top leg straight up',
      'Pause at the top, lower slowly to a stretch',
      'Keep the leg slightly behind the body to bias the glute',
    ],
  },
  bandWalk: {
    name: 'Lateral band walk', muscle: 'Glutes (medius)', equip: 'body',
    video: 'lateral band walk glute medius form',
    cue: 'Band at knees, step out wide',
    alts: ['hipAbduction', 'standingCableAbduction', 'sideLyingAbduction'],
    form: [
      'Band around your knees or ankles, athletic stance',
      'Step out to the side, keeping tension on the band',
      'Stay low and don’t let the knees cave',
      'Great as a warm-up activator or finisher',
    ],
  },
  clamshell: {
    name: 'Banded clamshell', muscle: 'Glutes (minimus)', equip: 'body',
    video: 'clamshell glute minimus form',
    cue: 'Knees open against the band',
    alts: ['internalRotAbduction', 'stepUpLateral'],
    form: [
      'Lie on your side, knees bent, band around your knees',
      'Open the top knee against the band, feet together',
      'Hold and squeeze, lower slowly',
      'Hits the minimus alongside the medius',
    ],
  },
  internalRotAbduction: {
    name: 'Cable abduction (internally rotated)', muscle: 'Glutes (minimus)', equip: 'cable',
    video: 'internally rotated hip abduction glute minimus form',
    cue: 'Toe turned in, lift out to the side',
    alts: ['clamshell', 'stepUpLateral'],
    form: [
      'Ankle cuff on a low pulley, slightly internally rotate the foot',
      'Lift out to the side — the internal rotation biases the minimus',
      'Keep the torso still',
      'Control back to the start under tension',
    ],
  },
  stepUpLateral: {
    name: 'Lateral step-up', muscle: 'Glutes (minimus)', equip: 'dumbbell',
    video: 'lateral step up glute form',
    cue: 'Drive up through the top foot',
    alts: ['clamshell', 'internalRotAbduction'],
    form: [
      'Stand side-on to a box, dumbbells at your sides',
      'Step up onto the box driving through the top foot',
      'The minimus and medius stabilise the pelvis through the single-leg phase',
      'Lower under control; alternate sides',
    ],
  },
  cossackSquat: {
    name: 'Cossack squat', muscle: 'Inner thighs', equip: 'dumbbell',
    video: 'cossack squat adductor form',
    cue: 'Shift side to side, deep stretch',
    alts: ['hipAdduction', 'cableHipAdduction'],
    form: [
      'Wide stance, shift your weight onto one bent leg',
      'The straight leg’s adductor gets a deep loaded stretch',
      'Stay as upright as you can, heel down',
      'Push back to centre and shift to the other side',
    ],
  },
  donkeyCalf: {
    name: 'Donkey calf raise', muscle: 'Calves (gastrocnemius)', equip: 'machine',
    video: 'donkey calf raise form',
    cue: 'Hips hinged, deepest stretch',
    alts: ['standingCalf', 'calfPress', 'singleLegCalf'],
    form: [
      'Hinge forward at the hips with the pad on your lower back',
      'Let your heels drop for the deepest gastroc stretch',
      'Rise onto the balls of your feet and squeeze',
      'Pause at the bottom stretch each rep',
    ],
  },
  singleLegCalf: {
    name: 'Single-leg standing calf raise', muscle: 'Calves (gastrocnemius)', equip: 'dumbbell',
    video: 'single leg calf raise form',
    cue: 'One leg, full ROM off a step',
    alts: ['standingCalf', 'calfPress', 'donkeyCalf'],
    form: [
      'Stand on one foot on a step, dumbbell in the same-side hand',
      'Let the heel drop below the step for a full stretch',
      'Rise as high as you can onto the ball of the foot',
      'Pause top and bottom; harder to cheat than two legs',
    ],
  },
  smithCalf: {
    name: 'Smith machine calf raise', muscle: 'Calves (gastrocnemius)', equip: 'machine',
    video: 'smith machine calf raise form',
    cue: 'Bar on traps, deep stretch off a plate',
    alts: ['standingCalf', 'calfPress', 'donkeyCalf'],
    form: [
      'Bar across your traps, balls of your feet on a plate',
      'Let the heels sink for a deep stretch',
      'Rise as high as possible and squeeze',
      'Heavy loading without balance demands',
    ],
  },
  seatedCalfPause: {
    name: 'Seated calf raise (paused)', muscle: 'Calves (soleus)', equip: 'machine',
    video: 'seated calf raise pause soleus form',
    cue: '2-second pause at the bottom stretch',
    alts: ['seatedCalf', 'legPressSoleus', 'singleLegSeatedCalf'],
    form: [
      'Knees bent under the pad, balls of feet on the platform',
      'Lower into a deep stretch and pause for 2 seconds',
      'Rise up and squeeze the soleus',
      'The pause at length is where soleus growth comes from',
    ],
  },
  legPressSoleus: {
    name: 'Leg press calf raise (knees bent)', muscle: 'Calves (soleus)', equip: 'machine',
    video: 'leg press calf raise bent knee soleus form',
    cue: 'Knees ~90°, press through the toes',
    alts: ['seatedCalf', 'seatedCalfPause', 'singleLegSeatedCalf'],
    form: [
      'Sit in the leg press with knees bent around 90°',
      'Balls of the feet on the bottom edge of the platform',
      'Press through the toes, let the heels drop for a stretch',
      'Bent knees take the gastroc out — pure soleus',
    ],
  },
  singleLegSeatedCalf: {
    name: 'Single-leg seated calf raise', muscle: 'Calves (soleus)', equip: 'dumbbell',
    video: 'single leg seated calf raise dumbbell form',
    cue: 'One knee, dumbbell on the thigh',
    alts: ['seatedCalf', 'seatedCalfPause', 'legPressSoleus'],
    form: [
      'Seated, dumbbell resting on one knee, ball of the foot on a block',
      'Lower into a deep stretch under control',
      'Rise up and squeeze the soleus',
      'Precise unilateral work for side-to-side balance',
    ],
  },

  /* ---------- chest ---------- */
  dbBenchPress: {
    name: 'Dumbbell bench press', muscle: 'Chest (lower)', equip: 'dumbbell', media: 'Dumbbell_Bench_Press',
    video: 'dumbbell bench press proper form',
    videoId: 'Y_7aHqXeCfQ', videoIdF: 'YwrzZaNqJWU',
    cue: 'Elbows ~45°, stretch at the bottom',
    alts: ['chestPressMachine', 'barbellBench', 'pushup'],
    form: [
      'Lie on the bench with dumbbells over your chest',
      'Lower with elbows about 45° from your sides until you feel a chest stretch',
      'Press up and slightly together over your chest',
      'Feet planted, shoulder blades pinched — no bouncing',
    ],
  },
  barbellBench: {
    name: 'Barbell bench press', muscle: 'Chest (lower)', equip: 'barbell', media: 'Barbell_Bench_Press_-_Medium_Grip',
    video: 'barbell bench press proper form',
    videoId: 'ysUTNll8JQ8',
    cue: 'Shoulder blades pinned, bar to mid-chest',
    alts: ['dbBenchPress', 'chestPressMachine'],
    form: [
      'Eyes under the bar, feet planted, shoulder blades squeezed together',
      'Grip just outside shoulder width',
      'Lower to mid-chest with elbows about 45° from your sides',
      'Press up over the shoulders — don’t bounce off the chest',
    ],
  },
  chestPressMachine: {
    name: 'Chest press (machine)', muscle: 'Chest (lower)', equip: 'machine', media: 'Machine_Bench_Press',
    video: 'chest press machine proper form',
    videoId: 'zgP-UCKGe24',
    cue: 'Slow return, full stretch',
    alts: ['dbBenchPress', 'pushup'],
    form: [
      'Set the seat so the handles line up with mid-chest',
      'Press out without slamming the elbows straight',
      'Return slowly until you feel a slight chest stretch',
      'Shoulders stay back against the pad the whole set',
    ],
  },
  pushup: {
    name: 'Push-up', muscle: 'Chest (lower)', equip: 'body', media: 'Pushups',
    video: 'push up proper form',
    videoId: 'IODxDxX7oi4',
    cue: 'Body in one straight line',
    alts: ['dbBenchPress', 'chestPressMachine'],
    form: [
      'Hands slightly wider than shoulders, body in one straight line',
      'Lower your chest to just above the floor, elbows ~45°',
      'Squeeze abs and glutes the whole way',
      'Drop to your knees if full reps break form',
    ],
  },
  inclineDbPress: {
    name: 'Incline dumbbell press', muscle: 'Chest (upper)', equip: 'dumbbell', media: 'Incline_Dumbbell_Press',
    video: 'incline dumbbell press proper form',
    cue: 'Bench ~30°, elbows tucked ~45°',
    alts: ['inclineBarbell', 'dbBenchPress', 'chestPressMachine'],
    form: [
      'Set the bench to about 30° — higher hits more front delt than upper chest',
      'Dumbbells start at upper-chest level, elbows ~45° from your torso',
      'Press up and slightly together; feel the upper chest',
      'Lower under control to a stretch — don’t bounce off the shoulders',
    ],
  },
  inclineBarbell: {
    name: 'Incline barbell press', muscle: 'Chest (upper)', equip: 'barbell', media: 'Barbell_Incline_Bench_Press_-_Medium_Grip',
    video: 'incline barbell bench press proper form',
    cue: 'Bench ~30°, bar to upper chest',
    alts: ['inclineDbPress', 'barbellBench', 'chestPressMachine'],
    form: [
      'Bench around 30°, shoulder blades pinned back',
      'Grip just outside shoulder width',
      'Lower the bar to your upper chest / collarbone line',
      'Press up over the shoulders — no bounce',
    ],
  },
  cableFly: {
    name: 'Cable fly', muscle: 'Chest (lower)', equip: 'cable', media: 'Cable_Crossover',
    video: 'cable crossover chest fly proper form',
    cue: 'Soft elbows, hug and squeeze',
    alts: ['inclineDbPress', 'chestPressMachine', 'dbBenchPress'],
    form: [
      'Slight forward lean, soft bend in the elbows held constant',
      'Bring your hands together in a wide hugging arc',
      'Squeeze the chest at the middle for a beat',
      'Open back to a stretch under control',
    ],
  },
  inclineSmith: {
    name: 'Incline Smith machine press', muscle: 'Chest (upper)', equip: 'machine',
    video: 'incline smith machine press upper chest form',
    cue: 'Bench ~30°, bar to upper chest',
    alts: ['inclineDbPress', 'inclineBarbell', 'lowCableFly'],
    form: [
      'Set an adjustable bench to about 30° under the Smith bar',
      'Unrack and lower the bar to your upper chest / collarbone line',
      'Elbows about 45° from your torso, shoulder blades pinned',
      'Press straight up the fixed path — no bounce',
    ],
  },
  lowCableFly: {
    name: 'Low-to-high cable fly', muscle: 'Chest (upper)', equip: 'cable',
    video: 'low to high cable fly upper chest form',
    cue: 'Sweep up and in, squeeze the upper chest',
    alts: ['inclineDbPress', 'inclineSmith', 'reverseGripBench'],
    form: [
      'Set both pulleys to the lowest position, a handle in each hand',
      'Keep a soft, constant bend in the elbows',
      'Sweep your hands up and together toward eye level',
      'Squeeze the upper chest at the top; lower under control to a stretch',
    ],
  },
  reverseGripBench: {
    name: 'Reverse-grip bench press', muscle: 'Chest (upper)', equip: 'barbell',
    video: 'reverse grip bench press upper chest form',
    cue: 'Supinated grip, bar to lower chest',
    alts: ['inclineDbPress', 'inclineBarbell', 'inclineSmith'],
    form: [
      'Lie flat and grip the bar with palms facing you (supinated)',
      'Use a spotter — unracking a reverse grip is awkward',
      'Lower to your lower chest with elbows tucked',
      'Press up; the supinated grip shifts load to the upper chest',
    ],
  },
  chestDip: {
    name: 'Weighted chest dip', muscle: 'Chest (lower)', equip: 'body',
    video: 'chest dip lower chest forward lean form',
    cue: 'Lean forward, elbows flare slightly',
    alts: ['declineDbPress', 'declineBench', 'highCableFly'],
    form: [
      'Grip parallel bars and lean your torso forward about 30°',
      'Lower until you feel a stretch across the lower chest',
      'Let the elbows drift slightly out, not tucked to the body',
      'Press up and slightly in; add a belt once bodyweight is easy',
    ],
  },
  highCableFly: {
    name: 'High-to-low cable crossover', muscle: 'Chest (lower)', equip: 'cable',
    video: 'high to low cable crossover lower chest form',
    cue: 'Sweep down and in to your hips',
    alts: ['chestDip', 'declineDbPress', 'declineBench'],
    form: [
      'Set both pulleys high, a handle in each hand, slight forward lean',
      'Keep a soft, constant bend in the elbows',
      'Sweep your hands down and together toward your hips',
      'Squeeze the lower chest; return to a stretch under control',
    ],
  },
  declineDbPress: {
    name: 'Decline dumbbell press', muscle: 'Chest (lower)', equip: 'dumbbell',
    video: 'decline dumbbell press lower chest form',
    cue: 'Decline bench, press over the lower chest',
    alts: ['declineBench', 'chestDip', 'highCableFly'],
    form: [
      'Set the bench to a slight decline, dumbbells over your lower chest',
      'Lower with elbows ~45° until you feel a chest stretch',
      'Press up and slightly together over the lower chest',
      'Brace your core; don’t let the dumbbells drift overhead',
    ],
  },
  declineBench: {
    name: 'Decline barbell bench press', muscle: 'Chest (lower)', equip: 'barbell',
    video: 'decline barbell bench press lower chest form',
    cue: 'Bar to lower chest, full control',
    alts: ['declineDbPress', 'chestDip', 'highCableFly'],
    form: [
      'Secure your legs, set a slight decline, grip just outside your shoulders',
      'Lower the bar to your lower-chest line',
      'Keep elbows about 45° from your torso',
      'Press up over the lower chest — use a spotter for heavy sets',
    ],
  },
  seatedCableFly: {
    name: 'Seated cable fly', muscle: 'Chest (inner)', equip: 'cable',
    video: 'seated cable fly chest form',
    cue: 'Full adduction, hands meet and squeeze',
    alts: ['pecDeck', 'singleCableFly', 'dumbbellFly'],
    form: [
      'Sit between two pulleys set near shoulder height, a handle in each hand',
      'Soft constant elbow bend, slight forward lean',
      'Bring your hands together in a wide hugging arc',
      'Cross slightly at the middle for full adduction, then open to a stretch',
    ],
  },
  pecDeck: {
    name: 'Pec deck (chest fly machine)', muscle: 'Chest (inner)', equip: 'machine',
    video: 'pec deck machine chest fly form',
    cue: 'Squeeze hands together, slow return',
    alts: ['seatedCableFly', 'singleCableFly', 'dumbbellFly'],
    form: [
      'Set the seat so the handles line up with mid-chest',
      'Forearms or hands on the pads, slight elbow bend',
      'Bring the pads together and squeeze the chest at the middle',
      'Return slowly until you feel a stretch across the chest',
    ],
  },
  singleCableFly: {
    name: 'Single-arm cable fly', muscle: 'Chest (inner)', equip: 'cable',
    video: 'single arm cable fly chest form',
    cue: 'Rotate across the body, full squeeze',
    alts: ['seatedCableFly', 'pecDeck', 'dumbbellFly'],
    form: [
      'Stand side-on to one pulley at chest height, handle in the far hand',
      'Soft constant elbow bend, staggered stance',
      'Sweep the handle across your body, rotating the torso slightly',
      'Squeeze the chest, return slowly to a deep stretch',
    ],
  },
  dumbbellFly: {
    name: 'Dumbbell fly', muscle: 'Chest (inner)', equip: 'dumbbell',
    video: 'dumbbell chest fly form',
    cue: 'Wide arc, deep stretch at the bottom',
    alts: ['seatedCableFly', 'pecDeck', 'singleCableFly'],
    form: [
      'Lie flat, dumbbells over your chest, palms facing each other',
      'Keep a soft, constant bend in the elbows throughout',
      'Open your arms in a wide arc until you feel a deep chest stretch',
      'Hug the dumbbells back together; tension fades at the top, so pair with a cable variation',
    ],
  },

  /* ---------- back ---------- */
  dbRow: {
    name: 'One-arm dumbbell row', muscle: 'Back (mid)', equip: 'dumbbell', media: 'One-Arm_Dumbbell_Row',
    video: 'one arm dumbbell row proper form',
    videoId: 'sUqz6oaISkQ', videoIdF: 'OG5S3x7T8QQ',
    cue: 'Pull to your hip, flat back',
    alts: ['seatedCableRow', 'barbellRow', 'latPulldown'],
    form: [
      'One knee and hand on the bench, back flat',
      'Pull the dumbbell up toward your hip, not your chest',
      'Squeeze the shoulder blade at the top',
      'Lower slowly — no twisting',
    ],
  },
  barbellRow: {
    name: 'Barbell row', muscle: 'Back (mid)', equip: 'barbell', media: 'Bent_Over_Barbell_Row',
    video: 'barbell bent over row proper form',
    videoId: 'vT2GjY_Umpw',
    cue: 'Hinge and hold, pull to lower ribs',
    alts: ['dbRow', 'seatedCableRow'],
    form: [
      'Hinge to about 45°, back flat, bar hanging at your knees',
      'Pull the bar to your lower ribs',
      'Squeeze your shoulder blades — no jerking with the lower back',
      'Lower under control',
    ],
  },
  seatedCableRow: {
    name: 'Seated cable row', muscle: 'Back (mid)', equip: 'cable', media: 'Seated_Cable_Rows',
    video: 'seated cable row proper form',
    videoId: '7BkgqzC6WsM',
    cue: 'Chest tall, elbows to your sides',
    alts: ['dbRow', 'barbellRow', 'latPulldown'],
    form: [
      'Chest tall, slight bend in the knees',
      'Pull the handle to your belly button',
      'Squeeze your shoulder blades together',
      'Let your arms reach fully forward, back stays flat',
    ],
  },
  latPulldown: {
    name: 'Lat pulldown', muscle: 'Back (lats)', equip: 'machine', media: 'Wide-Grip_Lat_Pulldown',
    video: 'lat pulldown proper form',
    videoId: 'CAwf7n6Luuc', videoIdF: '8XSbFIO3-vQ',
    cue: 'Elbows down and back',
    alts: ['pullup', 'seatedCableRow', 'dbRow'],
    form: [
      'Grip a bit wider than your shoulders, chest tall',
      'Pull the bar to your collarbone, elbows driving down and back',
      'Squeeze your lats at the bottom',
      'Control the way up — don’t let the stack yank you',
    ],
  },
  pullup: {
    name: 'Pull-up', muscle: 'Back (lats)', equip: 'body', media: 'Pullups',
    video: 'pull up proper form',
    videoId: '8hPL_86HwI4', videoIdF: 'x3NPAxiMRPw',
    cue: 'Chest to the bar, full hang',
    alts: ['latPulldown', 'dbRow'],
    form: [
      'Hands just outside shoulders, start from a full hang',
      'Pull your chest toward the bar, elbows down',
      'Lower all the way under control',
      'Use a band or the assisted machine if you need help',
    ],
  },
  neutralPulldown: {
    name: 'Neutral-grip lat pulldown', muscle: 'Back (lats)', equip: 'machine',
    video: 'neutral grip lat pulldown form',
    cue: 'Palms facing, elbows down and back',
    alts: ['latPulldown', 'pullup', 'kneelingPulldown'],
    form: [
      'Use a neutral (palms-facing) handle, chest tall',
      'Pull the handle to your upper chest, elbows driving down',
      'Squeeze the lats at the bottom',
      'Control the way up to a full overhead stretch',
    ],
  },
  kneelingPulldown: {
    name: 'Half-kneeling single-arm lat pulldown', muscle: 'Back (lats)', equip: 'cable',
    video: 'half kneeling single arm lat pulldown form',
    cue: 'One arm, full stretch overhead',
    alts: ['latPulldown', 'pullup', 'neutralPulldown'],
    form: [
      'Half-kneel under a high pulley, single handle in one hand',
      'Reach fully overhead for a deep lat stretch',
      'Pull the elbow down to your side, rotating slightly',
      'Control back up; keep the torso still',
    ],
  },
  chestSupportedRow: {
    name: 'Chest-supported row', muscle: 'Back (mid)', equip: 'machine',
    video: 'chest supported row form',
    cue: 'Chest on the pad, elbows ~45°',
    alts: ['seatedCableRow', 'dbRow', 'barbellRow', 'meadowsRow'],
    form: [
      'Set your chest against the pad, feet planted',
      'Pull the handles back with elbows about 45° from your body',
      'Squeeze the lats and mid-back at the top',
      'Lower under control — no lower-back drive',
    ],
  },
  meadowsRow: {
    name: 'Meadows row (landmine)', muscle: 'Back (mid)', equip: 'barbell',
    video: 'meadows row landmine form',
    cue: 'Big stretch at the bottom each rep',
    alts: ['dbRow', 'barbellRow', 'chestSupportedRow'],
    form: [
      'Stand side-on to a landmine, grip the sleeve end overhand',
      'Hinge over and let the arm reach down for a deep lat stretch',
      'Pull the elbow up toward your hip',
      'Lower all the way to the stretch each rep',
    ],
  },
  sealRow: {
    name: 'Seal row', muscle: 'Back (rhomboids)', equip: 'barbell',
    video: 'seal row prone bench form',
    cue: 'Lie prone, retract shoulder blades hard',
    alts: ['overhandRow', 'chestSupportedRowWide'],
    form: [
      'Lie face-down on an elevated bench, weight hanging below',
      'Pull up, driving the elbows back and out',
      'Squeeze the shoulder blades together at the top',
      'No body english — the chest stays pinned to the bench',
    ],
  },
  overhandRow: {
    name: 'Overhand barbell row (flared)', muscle: 'Back (rhomboids)', equip: 'barbell',
    video: 'overhand barbell row upper back form',
    cue: 'Elbows flared, pull to the sternum',
    alts: ['sealRow', 'chestSupportedRowWide'],
    form: [
      'Hinge to about 45°, overhand grip wider than shoulders',
      'Pull the bar to your lower sternum with elbows flared out',
      'Squeeze the shoulder blades together hard',
      'Lower under control, back flat',
    ],
  },
  chestSupportedRowWide: {
    name: 'Chest-supported row (elbows flared)', muscle: 'Back (rhomboids)', equip: 'machine',
    video: 'chest supported row elbows flared rhomboids form',
    cue: 'Wide grip, elbows out, retract',
    alts: ['sealRow', 'overhandRow'],
    form: [
      'Chest on the pad, take a wide overhand grip',
      'Pull with the elbows flared out to about 70°',
      'Drive the shoulder blades together at the top',
      'Lower slowly to a full stretch',
    ],
  },
  trapBarShrug: {
    name: 'Trap bar shrug', muscle: 'Traps (upper)', equip: 'barbell',
    video: 'trap bar shrug form',
    cue: 'Shrug straight up, pause at the top',
    alts: ['barbellShrug', 'dumbbellShrug', 'cableShrug'],
    form: [
      'Stand inside a loaded trap bar, neutral grip',
      'Shrug your shoulders straight up toward your ears',
      'Pause and squeeze for a second at the top',
      'Lower under control — no rolling',
    ],
  },
  barbellShrug: {
    name: 'Barbell shrug', muscle: 'Traps (upper)', equip: 'barbell',
    video: 'barbell shrug form',
    cue: 'Straight up, 1-second squeeze',
    alts: ['trapBarShrug', 'dumbbellShrug', 'cableShrug'],
    form: [
      'Hold a barbell at arm’s length, hands shoulder-width',
      'Shrug straight up toward your ears',
      'Squeeze hard at the top for a second',
      'Lower fully — don’t roll the shoulders',
    ],
  },
  dumbbellShrug: {
    name: 'Dumbbell shrug', muscle: 'Traps (upper)', equip: 'dumbbell',
    video: 'dumbbell shrug form',
    cue: 'Natural grip, controlled ROM',
    alts: ['barbellShrug', 'trapBarShrug', 'cableShrug'],
    form: [
      'A dumbbell in each hand at your sides, palms facing in',
      'Shrug straight up toward your ears',
      'Pause and squeeze at the top',
      'Lower under control to a full stretch',
    ],
  },
  cableShrug: {
    name: 'Cable shrug', muscle: 'Traps (upper)', equip: 'cable',
    video: 'cable shrug low pulley form',
    cue: 'Constant tension through the top',
    alts: ['barbellShrug', 'dumbbellShrug', 'trapBarShrug'],
    form: [
      'Hold a low-pulley bar at arm’s length',
      'Shrug straight up — the cable keeps tension at the top',
      'Squeeze for a second',
      'Lower slowly; resistance stays on the whole way',
    ],
  },
  proneYRaise: {
    name: 'Prone Y-raise', muscle: 'Traps (lower)', equip: 'dumbbell',
    video: 'prone y raise lower trap form',
    cue: 'Arms in a Y, thumbs up',
    alts: ['cableYRaise', 'straightArmPulldown'],
    form: [
      'Lie chest-down on an incline bench, light dumbbells',
      'Raise your arms into a Y shape, thumbs pointing up',
      'Lead with the pinkies, squeeze the lower traps',
      'Lower slowly; keep the weight light',
    ],
  },
  cableYRaise: {
    name: 'Cable Y-raise', muscle: 'Traps (lower)', equip: 'cable',
    video: 'cable y raise lower trap form',
    cue: 'Drive arms overhead into a Y',
    alts: ['proneYRaise', 'straightArmPulldown'],
    form: [
      'Two low pulleys, cables crossed, a handle in each hand',
      'Sweep your arms up and out into a Y overhead',
      'Thumbs up, squeeze the lower traps at the top',
      'Lower under control against the cable tension',
    ],
  },
  straightArmPulldown: {
    name: 'Straight-arm pulldown', muscle: 'Traps (lower)', equip: 'cable',
    video: 'straight arm pulldown lats lower trap form',
    cue: 'Depress the scapula, arms straight',
    alts: ['proneYRaise', 'cableYRaise'],
    form: [
      'Stand at a high pulley, straight bar, arms extended',
      'Keeping the arms straight, drive the bar down to your thighs',
      'Consciously pull the shoulder blades down at the bottom',
      'Control back up to a full overhead stretch',
    ],
  },
  hyperextension: {
    name: 'Back extension (45°)', muscle: 'Lower back', equip: 'machine',
    video: '45 degree back extension form',
    cue: 'Hinge and extend through the spine',
    alts: ['goodMorning', 'conventionalDeadlift'],
    form: [
      'Set the pad at your hips on a 45° or horizontal bench',
      'Hinge down with a slight rounding, hands at your chest',
      'Extend up until your body is a straight line — don’t hyperextend',
      'Add a plate to your chest to load it',
    ],
  },
  goodMorning: {
    name: 'Good morning (barbell)', muscle: 'Lower back', equip: 'barbell',
    video: 'barbell good morning form',
    cue: 'Soft knees, hinge at the hips',
    alts: ['hyperextension', 'conventionalDeadlift'],
    form: [
      'Bar on your back like a squat, soft knees',
      'Hinge forward at the hips, pushing them back, flat spine',
      'Feel the hamstrings and lower back load at the stretch',
      'Drive the hips forward to stand tall — keep it light to learn',
    ],
  },
  conventionalDeadlift: {
    name: 'Conventional deadlift', muscle: 'Lower back', equip: 'barbell',
    video: 'conventional deadlift form',
    cue: 'Flat back, push the floor away',
    alts: ['hyperextension', 'goodMorning'],
    form: [
      'Bar over mid-foot, shins close, grip just outside your knees',
      'Flat back, chest up, take the slack out of the bar',
      'Push the floor away and stand tall, bar close to your body',
      'Lower by pushing your hips back; reset each rep',
    ],
  },

  /* ---------- shoulders ---------- */
  dbShoulderPress: {
    name: 'Dumbbell shoulder press', muscle: 'Shoulders (front)', equip: 'dumbbell', media: 'Dumbbell_Shoulder_Press',
    video: 'dumbbell shoulder press proper form',
    videoId: 'vlFGTI5JzjI', videoIdF: 'qGtDCtYeRQM',
    cue: 'Press up, don’t arch back',
    alts: ['machineShoulderPress', 'ohp'],
    form: [
      'Dumbbells at shoulder height, palms forward',
      'Press up until your arms are straight, biceps by your ears',
      'Lower to about ear level under control',
      'Ribs down — don’t arch your lower back',
    ],
  },
  ohp: {
    name: 'Overhead press (barbell)', muscle: 'Shoulders (front)', equip: 'barbell', media: 'Standing_Military_Press',
    video: 'barbell overhead press proper form',
    videoId: '2yjwXTZQDDI',
    cue: 'Brace hard, bar over mid-foot',
    alts: ['dbShoulderPress', 'machineShoulderPress'],
    form: [
      'Bar at your collarbone, grip just outside shoulders',
      'Squeeze abs and glutes, press straight up',
      'Move your head slightly back, then through at the top',
      'Lower to the collarbone under control',
    ],
  },
  machineShoulderPress: {
    name: 'Shoulder press (machine)', muscle: 'Shoulders (front)', equip: 'machine', media: 'Machine_Shoulder_Military_Press',
    video: 'machine shoulder press proper form',
    videoId: '3R14MnZbcpw',
    cue: 'Back on the pad, smooth reps',
    alts: ['dbShoulderPress', 'ohp'],
    form: [
      'Seat set so the handles start at shoulder height',
      'Press up without slamming the lockout',
      'Lower slowly until elbows are just below shoulder line',
      'Back stays on the pad',
    ],
  },
  lateralRaise: {
    name: 'Lateral raise', muscle: 'Side delts', equip: 'dumbbell', media: 'Side_Lateral_Raise',
    video: 'dumbbell lateral raise proper form',
    videoId: 'JIhbYYA1Q90',
    cue: 'Lead with the elbows, no swinging',
    alts: ['dbShoulderPress', 'machineShoulderPress'],
    form: [
      'Slight bend in the elbows, lead the lift with your elbows',
      'Raise out to shoulder height — no higher',
      'Tilt slightly, like pouring water from a jug',
      'Lower slowly; if you have to swing, it’s too heavy',
    ],
  },
  landminePress: {
    name: 'Landmine press (half-kneeling)', muscle: 'Shoulders (front)', equip: 'barbell',
    video: 'half kneeling landmine press form',
    cue: 'Press up and slightly across',
    alts: ['dbShoulderPress', 'machineShoulderPress', 'ohp'],
    form: [
      'Half-kneel facing a landmine, bar end in one hand at your shoulder',
      'Press up and slightly forward along the diagonal path',
      'Keep your ribs down and core braced',
      'Lower under control; the angle is easy on the shoulder',
    ],
  },
  cableFrontRaise: {
    name: 'Cable front raise', muscle: 'Shoulders (front)', equip: 'cable',
    video: 'cable front raise front delt form',
    cue: 'Raise to eye level, no swing',
    alts: ['dbShoulderPress', 'machineShoulderPress'],
    form: [
      'Low pulley behind or beside you, handle in one hand',
      'Raise your arm straight out in front to about eye level',
      'No swinging — the cable keeps tension at the bottom',
      'Front delts get heavy indirect work from pressing, so keep this volume low',
    ],
  },
  cableLateralRaise: {
    name: 'Cable lateral raise', muscle: 'Side delts', equip: 'cable',
    video: 'cable lateral raise side delt form',
    cue: 'Cable from the opposite hip, lead the elbow',
    alts: ['lateralRaise', 'behindBackCableLateral', 'machineLateralRaise'],
    form: [
      'Stand side-on to a low pulley, handle in the outside hand across your body',
      'Slight forward lean, lead the raise with your elbow',
      'Raise to shoulder height, thumb slightly down',
      'Lower slowly — the cable keeps tension at the bottom',
    ],
  },
  behindBackCableLateral: {
    name: 'Behind-the-back cable lateral raise', muscle: 'Side delts', equip: 'cable',
    video: 'behind the back cable lateral raise form',
    cue: 'Cable behind you, tension at the stretch',
    alts: ['cableLateralRaise', 'lateralRaise', 'machineLateralRaise'],
    form: [
      'Stand with a low pulley behind your body, handle in the near hand',
      'The cable runs behind you so tension stays on at the bottom',
      'Raise out to the side to shoulder height and slightly past',
      'Lower under control to a full stretch',
    ],
  },
  machineLateralRaise: {
    name: 'Machine lateral raise', muscle: 'Side delts', equip: 'machine',
    video: 'machine lateral raise form',
    cue: 'Pads on the forearms, smooth reps',
    alts: ['cableLateralRaise', 'lateralRaise', 'behindBackCableLateral'],
    form: [
      'Sit with the pads against your outer forearms',
      'Raise the pads out to shoulder height, leading with the elbows',
      'Squeeze the side delts at the top',
      'Lower slowly; great for high reps with no balance demand',
    ],
  },
  reverseCableCrossover: {
    name: 'Reverse cable crossover', muscle: 'Rear delts', equip: 'cable',
    video: 'reverse cable crossover rear delt form',
    cue: 'Arms crossed high, sweep out and back',
    alts: ['reversePecDeck', 'lyingReverseCableFly', 'facePull'],
    form: [
      'Two high pulleys — grab the opposite handle in each hand (arms crossed)',
      'Sweep your arms out and back in a wide arc',
      'Lead with the pinkies, squeeze the rear delts',
      'Return under control — tension stays on at the stretch',
    ],
  },
  reversePecDeck: {
    name: 'Reverse pec deck', muscle: 'Rear delts', equip: 'machine',
    video: 'reverse pec deck rear delt form',
    cue: 'Drive the handles back, squeeze',
    alts: ['reverseCableCrossover', 'facePull', 'lyingReverseCableFly'],
    form: [
      'Face the pad, grab the handles with your arms in front',
      'Drive the handles back in an arc, leading with the elbows',
      'Squeeze the rear delts at the back',
      'Return slowly; keep the traps relaxed',
    ],
  },
  facePull: {
    name: 'Face pull (rope)', muscle: 'Rear delts', equip: 'cable',
    video: 'face pull rope rear delt form',
    cue: 'Pull to your eyes, elbows high',
    alts: ['reversePecDeck', 'reverseCableCrossover', 'lyingReverseCableFly'],
    form: [
      'Rope on a high pulley, pull toward your eyes',
      'Elbows stay high, split the rope apart at your face',
      'Externally rotate so your knuckles point back',
      'Squeeze the rear delts and mid-back, return slowly',
    ],
  },
  lyingReverseCableFly: {
    name: 'Lying reverse cable fly', muscle: 'Rear delts', equip: 'cable',
    video: 'lying reverse cable fly rear delt form',
    cue: 'Bench support, sweep wide',
    alts: ['reverseCableCrossover', 'reversePecDeck', 'facePull'],
    form: [
      'Lie chest-up on a low bench between two low pulleys, cables crossed',
      'Sweep your arms out wide in an arc',
      'Lead with the pinkies, squeeze the rear delts',
      'The bench support increases the stretch at the bottom',
    ],
  },

  /* ---------- arms ---------- */
  bicepsCurl: {
    name: 'Dumbbell curl', muscle: 'Biceps (short head)', equip: 'dumbbell', media: 'Dumbbell_Bicep_Curl',
    video: 'dumbbell bicep curl proper form',
    videoId: 'Jfp4b5Olc7A',
    cue: 'Elbows pinned to your sides',
    alts: ['cableCurl', 'hammerCurl'],
    form: [
      'Elbows pinned to your sides',
      'Curl up without swinging your torso',
      'Squeeze at the top',
      'Lower slowly all the way down',
    ],
  },
  hammerCurl: {
    name: 'Hammer curl', muscle: 'Biceps (brachialis)', equip: 'dumbbell', media: 'Hammer_Curls',
    video: 'hammer curl proper form',
    cue: 'Neutral grip, thumbs up',
    alts: ['crossBodyHammer', 'reverseCurl', 'zottmanCurl'],
    form: [
      'Palms facing each other (neutral grip) the whole rep',
      'Elbows pinned, curl up without swinging',
      'Squeeze at the top — this hits the brachialis & forearms',
      'Lower slowly to a full stretch',
    ],
  },
  cableCurl: {
    name: 'Cable curl', muscle: 'Biceps (short head)', equip: 'cable', media: 'Standing_Biceps_Cable_Curl',
    video: 'cable bicep curl proper form',
    videoId: 'Qt-NixlIVGM',
    cue: 'Constant tension, full stretch',
    alts: ['bicepsCurl'],
    form: [
      'Elbows pinned, chest tall',
      'Curl to your shoulders and squeeze',
      'Lower slowly to a full stretch at the bottom',
      'No leaning back to cheat the weight up',
    ],
  },
  inclineCurl: {
    name: 'Incline dumbbell curl', muscle: 'Biceps (long head)', equip: 'dumbbell',
    video: 'incline dumbbell curl long head form',
    cue: 'Arms hang back, stretch the long head',
    alts: ['bayesianCurl', 'dragCurl', 'overheadCableCurl'],
    form: [
      'Sit back on a 45–60° incline bench, arms hanging straight down',
      'The behind-the-body arm position stretches the biceps long head',
      'Curl up without letting the elbows drift forward',
      'Lower all the way to a full stretch',
    ],
  },
  bayesianCurl: {
    name: 'Bayesian cable curl', muscle: 'Biceps (long head)', equip: 'cable',
    video: 'bayesian cable curl long head form',
    cue: 'Cable behind you, elbow stays back',
    alts: ['inclineCurl', 'overheadCableCurl', 'dragCurl'],
    form: [
      'Face away from a low pulley, handle in one hand, arm extended back',
      'Step forward so the cable pulls your arm behind your body',
      'Curl up keeping the elbow back — constant tension on the long head',
      'Lower slowly to a deep stretch',
    ],
  },
  dragCurl: {
    name: 'Dumbbell drag curl', muscle: 'Biceps (long head)', equip: 'dumbbell',
    video: 'drag curl long head biceps form',
    cue: 'Drag the weight up your body, elbows back',
    alts: ['inclineCurl', 'bayesianCurl', 'overheadCableCurl'],
    form: [
      'Stand tall, dumbbells at your sides',
      'Curl by dragging the weights straight up your torso',
      'Let the elbows travel backward as you lift',
      'Keeps the shoulder extended — long-head bias the whole rep',
    ],
  },
  overheadCableCurl: {
    name: 'Single-arm overhead cable curl', muscle: 'Biceps (long head)', equip: 'cable',
    video: 'overhead cable curl biceps long head form',
    cue: 'Arm out to the side, curl to your head',
    alts: ['bayesianCurl', 'inclineCurl', 'dragCurl'],
    form: [
      'Set a pulley at or above shoulder height, stand side-on',
      'Arm out straight to the side, palm up',
      'Curl the handle toward your head, squeezing the biceps',
      'The pulled-back arm puts a strong stretch on the long head',
    ],
  },
  preacherCurl: {
    name: 'Preacher curl', muscle: 'Biceps (short head)', equip: 'dumbbell',
    video: 'preacher curl short head form',
    cue: 'Upper arms flat on the pad',
    alts: ['machinePreacher', 'concentrationCurl', 'spiderCurl'],
    form: [
      'Upper arms flat on the preacher pad, EZ-bar or dumbbell',
      'The forward shoulder slackens the long head — short head leads',
      'Curl up, squeeze, then lower under control',
      'Don’t bounce out of the bottom stretch',
    ],
  },
  machinePreacher: {
    name: 'Machine preacher curl', muscle: 'Biceps (short head)', equip: 'machine',
    video: 'machine preacher curl form',
    cue: 'Constant tension, no dead spot',
    alts: ['preacherCurl', 'concentrationCurl', 'spiderCurl'],
    form: [
      'Upper arms on the pad, grip the handles',
      'Curl up — the cam keeps tension where free weights go light',
      'Squeeze hard at the top',
      'Lower slowly to a controlled stretch',
    ],
  },
  concentrationCurl: {
    name: 'Concentration curl', muscle: 'Biceps (short head)', equip: 'dumbbell',
    video: 'concentration curl form',
    cue: 'Elbow braced on the thigh',
    alts: ['preacherCurl', 'machinePreacher', 'spiderCurl'],
    form: [
      'Seated, elbow braced against the inside of your thigh',
      'Curl the dumbbell up toward your shoulder',
      'Squeeze hard at the top — pure short-head isolation',
      'Lower slowly to a full stretch',
    ],
  },
  spiderCurl: {
    name: 'Spider curl', muscle: 'Biceps (short head)', equip: 'dumbbell',
    video: 'spider curl incline bench form',
    cue: 'Chest down on incline, arms hang',
    alts: ['preacherCurl', 'machinePreacher', 'concentrationCurl'],
    form: [
      'Lie chest-down on an incline bench, arms hanging straight',
      'Curl the weights up with the elbows fixed',
      'The flexed shoulder biases the short head',
      'Squeeze at the top, lower to a full stretch',
    ],
  },
  crossBodyHammer: {
    name: 'Cross-body hammer curl', muscle: 'Biceps (brachialis)', equip: 'dumbbell',
    video: 'cross body hammer curl brachialis form',
    cue: 'Neutral grip, curl across to the chest',
    alts: ['hammerCurl', 'reverseCurl', 'zottmanCurl'],
    form: [
      'Neutral grip, a dumbbell in each hand',
      'Curl one arm across your body toward the opposite chest',
      'Keep the wrist neutral — brachialis leads',
      'Lower slowly and alternate',
    ],
  },
  reverseCurl: {
    name: 'Reverse curl (EZ-bar)', muscle: 'Biceps (brachialis)', equip: 'barbell',
    video: 'reverse curl brachialis brachioradialis form',
    cue: 'Pronated grip, knuckles up',
    alts: ['hammerCurl', 'crossBodyHammer', 'zottmanCurl'],
    form: [
      'Grip an EZ-bar overhand (palms down)',
      'Curl up keeping the wrists firm, knuckles toward the ceiling',
      'The pronated grip loads the brachialis and forearms',
      'Lower under control',
    ],
  },
  zottmanCurl: {
    name: 'Zottman curl', muscle: 'Biceps (brachialis)', equip: 'dumbbell',
    video: 'zottman curl form',
    cue: 'Supinate up, pronate down',
    alts: ['hammerCurl', 'crossBodyHammer', 'reverseCurl'],
    form: [
      'Curl up with palms up (supinated) like a normal curl',
      'At the top, rotate to palms down (pronated)',
      'Lower the weight slowly in the pronated position',
      'Trains the brachialis and brachioradialis on the eccentric',
    ],
  },
  tricepsPushdown: {
    name: 'Triceps pushdown', muscle: 'Triceps (lateral head)', equip: 'cable', media: 'Triceps_Pushdown',
    video: 'tricep pushdown proper form',
    videoId: '_w-HpW70nSQ',
    cue: 'Elbows glued to your sides',
    alts: ['overheadTriceps'],
    form: [
      'Elbows pinned to your sides',
      'Push the bar or rope down to full lockout',
      'Squeeze the triceps at the bottom',
      'Let it rise only to chest height — elbows never move',
    ],
  },
  overheadTriceps: {
    name: 'Overhead triceps extension', muscle: 'Triceps (long head)', equip: 'dumbbell', media: 'Standing_Dumbbell_Triceps_Extension',
    video: 'overhead dumbbell tricep extension proper form',
    videoId: '-Vyt2QdsR7E',
    cue: 'Deep stretch behind the head',
    alts: ['tricepsPushdown'],
    form: [
      'Hold one dumbbell with both hands overhead',
      'Lower it behind your head until you feel a deep stretch',
      'Elbows point forward, close to your head',
      'Press back up to straight arms',
    ],
  },
  overheadCableTriceps: {
    name: 'Overhead cable triceps extension', muscle: 'Triceps (long head)', equip: 'cable',
    video: 'overhead cable triceps extension long head form',
    cue: 'Lean in, stretch behind the head',
    alts: ['overheadTriceps', 'inclineSkullcrusher', 'ezFrenchPress'],
    form: [
      'Face away from a high pulley, rope or bar overhead, lean forward',
      'Let the weight stretch the triceps deep behind your head',
      'Extend to full lockout, elbows pointing forward',
      'Control back to the stretch — the best long-head builder',
    ],
  },
  inclineSkullcrusher: {
    name: 'Incline skullcrusher', muscle: 'Triceps (long head)', equip: 'barbell',
    video: 'incline skullcrusher ez bar long head form',
    cue: 'Elbows back, bar behind the head',
    alts: ['overheadTriceps', 'overheadCableTriceps', 'ezFrenchPress'],
    form: [
      'Lie on a 30–45° incline, EZ-bar held over your forehead',
      'Lower the bar behind your head, elbows pointing back',
      'The overhead angle stretches the long head more than flat',
      'Extend back up without flaring the elbows',
    ],
  },
  ezFrenchPress: {
    name: 'EZ-bar French press', muscle: 'Triceps (long head)', equip: 'barbell',
    video: 'seated ez bar french press overhead triceps form',
    cue: 'Seated, lower behind the head',
    alts: ['overheadTriceps', 'overheadCableTriceps', 'inclineSkullcrusher'],
    form: [
      'Seated, EZ-bar held overhead with a close grip',
      'Lower behind your head until you feel a deep stretch',
      'Keep the elbows close and pointing up',
      'Press back to full lockout',
    ],
  },
  vbarPushdown: {
    name: 'V-bar cable pushdown', muscle: 'Triceps (lateral head)', equip: 'cable',
    video: 'v bar pushdown triceps form',
    cue: 'Elbows pinned, full lockout',
    alts: ['tricepsPushdown', 'closeGripBench', 'weightedDipTri'],
    form: [
      'Attach a V-bar to a high pulley, elbows pinned to your sides',
      'Push down to full lockout',
      'Squeeze the triceps at the bottom',
      'Let it rise only to chest height — elbows never move',
    ],
  },
  closeGripBench: {
    name: 'Close-grip bench press', muscle: 'Triceps (lateral head)', equip: 'barbell',
    video: 'close grip bench press triceps form',
    cue: 'Hands ~shoulder width, elbows tucked',
    alts: ['tricepsPushdown', 'vbarPushdown', 'weightedDipTri'],
    form: [
      'Grip the bar about shoulder-width, elbows tucked',
      'Lower to your lower chest, keeping the elbows close',
      'Press up by driving through the triceps',
      'The best heavy compound for the triceps',
    ],
  },
  weightedDipTri: {
    name: 'Triceps dip (upright)', muscle: 'Triceps (lateral head)', equip: 'body',
    video: 'triceps dip upright torso form',
    cue: 'Upright torso, elbows in',
    alts: ['tricepsPushdown', 'vbarPushdown', 'closeGripBench'],
    form: [
      'Grip parallel bars, keep your torso upright (not leaned forward)',
      'Lower until your elbows reach about 90°',
      'Keep the elbows tucked in, not flared',
      'Press up to lockout; add a belt to load it',
    ],
  },
  reverseGripPushdown: {
    name: 'Reverse-grip cable pushdown', muscle: 'Triceps (medial head)', equip: 'cable',
    video: 'reverse grip pushdown medial head triceps form',
    cue: 'Supinated grip, full lockout',
    alts: ['ropePushdown', 'flatSkullcrusher', 'diamondPushup'],
    form: [
      'Single straight bar, grip underhand (palms up)',
      'Elbows pinned, push down to full lockout',
      'The supinated grip biases the medial head',
      'Control back up to chest height',
    ],
  },
  ropePushdown: {
    name: 'Rope pushdown', muscle: 'Triceps (medial head)', equip: 'cable',
    video: 'rope pushdown triceps full extension form',
    cue: 'Spread the rope at the bottom',
    alts: ['reverseGripPushdown', 'flatSkullcrusher', 'diamondPushup'],
    form: [
      'Rope on a high pulley, elbows pinned',
      'Push down and spread the rope apart at the bottom',
      'Full lockout engages the medial head at end-range',
      'Control back up — elbows stay still',
    ],
  },
  flatSkullcrusher: {
    name: 'Flat skullcrusher', muscle: 'Triceps (medial head)', equip: 'barbell',
    video: 'flat skullcrusher ez bar form',
    cue: 'Lower to the forehead, lock out hard',
    alts: ['reverseGripPushdown', 'ropePushdown', 'diamondPushup'],
    form: [
      'Lie flat, EZ-bar over your forehead, elbows pointing up',
      'Lower the bar to your forehead or just behind it',
      'Extend to a hard lockout — the medial head fires at full extension',
      'Keep the elbows from flaring out',
    ],
  },
  diamondPushup: {
    name: 'Diamond push-up', muscle: 'Triceps (medial head)', equip: 'body',
    video: 'diamond push up triceps form',
    cue: 'Hands together, elbows tucked',
    alts: ['reverseGripPushdown', 'ropePushdown', 'flatSkullcrusher'],
    form: [
      'Hands together forming a diamond under your chest',
      'Lower with the elbows tucked close to your body',
      'Press to full lockout — medial head dominant at the top',
      'Drop to your knees if full reps break form',
    ],
  },

  /* ---------- core ---------- */
  crunch: {
    name: 'Crunch', muscle: 'Abs', equip: 'body', media: 'Crunches',
    video: 'crunch proper form abs',
    videoId: 'tnZNcIqhGb0',
    cue: 'Ribs to hips, don’t pull the neck',
    alts: [],
    form: [
      'Knees bent, feet flat, hands by your temples',
      'Curl your ribs toward your hips — shoulder blades off the floor',
      'Exhale and squeeze at the top',
      'Lower slowly; never pull on your neck',
    ],
  },
  cableCrunch: {
    name: 'Cable crunch', muscle: 'Abs', equip: 'cable',
    video: 'cable crunch abs form',
    cue: 'Crunch ribs to hips, round the spine',
    alts: ['declineCrunch', 'abWheel', 'hangingLegRaise'],
    form: [
      'Kneel below a high pulley, rope held by your head',
      'Crunch down by rounding your spine, ribs toward your hips',
      'Keep the hips still — the abs flex, the arms don’t pull',
      'Add weight over time; treat abs like any other muscle',
    ],
  },
  abWheel: {
    name: 'Ab wheel rollout', muscle: 'Abs', equip: 'body',
    video: 'ab wheel rollout form',
    cue: 'Brace hard, roll out under control',
    alts: ['cableCrunch', 'hangingLegRaise', 'declineCrunch'],
    form: [
      'Kneel holding the wheel, brace your abs hard',
      'Roll out as far as you can keep a flat lower back',
      'The stretched position loads the abs strongly',
      'Pull back by crunching the abs, not the hips',
    ],
  },
  hangingLegRaise: {
    name: 'Hanging leg raise', muscle: 'Abs', equip: 'body',
    video: 'hanging leg raise toes to bar form',
    cue: 'Curl the pelvis up, no swinging',
    alts: ['cableCrunch', 'abWheel', 'declineCrunch'],
    form: [
      'Hang from a bar, legs straight or knees bent',
      'Raise the legs by curling your pelvis up, not just lifting the legs',
      'Control the lower — no swinging',
      'Toes-to-bar is the full-range progression',
    ],
  },
  declineCrunch: {
    name: 'Decline crunch (weighted)', muscle: 'Abs', equip: 'body',
    video: 'decline crunch weighted abs form',
    cue: 'Full ROM, hold a plate',
    alts: ['cableCrunch', 'abWheel', 'hangingLegRaise'],
    form: [
      'Anchor your legs on a decline bench, plate held at your chest',
      'Crunch up by rounding the spine, ribs toward hips',
      'The decline angle increases the range of motion',
      'Lower slowly under control',
    ],
  },
  cableWoodchopHigh: {
    name: 'Cable woodchop (high-to-low)', muscle: 'Obliques (external)', equip: 'cable',
    video: 'cable woodchop high to low obliques form',
    cue: 'Rotate from the torso, arms follow',
    alts: ['pallofPress', 'weightedSideBend', 'russianTwist'],
    form: [
      'High pulley, both hands on the handle, stand side-on',
      'Pull down and across to the opposite hip, rotating your torso',
      'Keep the arms fairly straight — rotation comes from the core',
      'Control back up; add weight to progress',
    ],
  },
  pallofPress: {
    name: 'Pallof press', muscle: 'Obliques (external)', equip: 'cable',
    video: 'pallof press anti rotation form',
    cue: 'Resist the twist, press straight out',
    alts: ['cableWoodchopHigh', 'weightedSideBend', 'russianTwist'],
    form: [
      'Stand side-on to a chest-height pulley, hands at your sternum',
      'Press the handle straight out and resist the cable twisting you',
      'Hold for a beat, return to your chest',
      'The obliques fire to stop rotation',
    ],
  },
  weightedSideBend: {
    name: 'Weighted side bend', muscle: 'Obliques (external)', equip: 'dumbbell',
    video: 'dumbbell side bend obliques form',
    cue: 'Bend straight to the side, one dumbbell',
    alts: ['cableWoodchopHigh', 'pallofPress', 'russianTwist'],
    form: [
      'Hold one dumbbell at your side, other hand on your head',
      'Bend straight to the side, lowering the weight down your leg',
      'Bend back up by contracting the opposite obliques',
      'Keep the other side relaxed; don’t lean forward',
    ],
  },
  russianTwist: {
    name: 'Russian twist (weighted)', muscle: 'Obliques (external)', equip: 'body',
    video: 'russian twist plate obliques form',
    cue: 'Rotate side to side, control it',
    alts: ['cableWoodchopHigh', 'pallofPress', 'weightedSideBend'],
    form: [
      'Sit with knees bent, lean back slightly, plate at your chest',
      'Rotate the plate side to side, touching near each hip',
      'Move from the torso, not just the arms',
      'Keep your chest tall; add load as you progress',
    ],
  },
  cableWoodchopLow: {
    name: 'Cable woodchop (low-to-high)', muscle: 'Obliques (internal)', equip: 'cable',
    video: 'cable woodchop low to high obliques form',
    cue: 'Drive up and across from a low pulley',
    alts: ['copenhagenPlank', 'sidePlankHipDrop', 'dragonFlag'],
    form: [
      'Low pulley, both hands on the handle, stand side-on',
      'Drive up and across toward the opposite shoulder, rotating the torso',
      'Arms stay fairly straight — rotation from the core',
      'Control back down; this arc biases the internal obliques',
    ],
  },
  copenhagenPlank: {
    name: 'Copenhagen plank', muscle: 'Obliques (internal)', equip: 'body',
    video: 'copenhagen plank form',
    cue: 'Top leg on the bench, hold the line',
    alts: ['sidePlankHipDrop', 'cableWoodchopLow', 'dragonFlag'],
    form: [
      'Side plank with your top foot or shin on a bench',
      'Lift your hips so your body is a straight line',
      'The adductors and internal obliques co-contract to hold it',
      'Start with the knee bent on the bench to regress',
    ],
  },
  sidePlankHipDrop: {
    name: 'Side plank with hip drop', muscle: 'Obliques (internal)', equip: 'body',
    video: 'side plank hip dip obliques form',
    cue: 'Dip the hip, then raise it',
    alts: ['copenhagenPlank', 'cableWoodchopLow', 'dragonFlag'],
    form: [
      'Set up in a side plank on your forearm',
      'Lower your hip toward the floor under control',
      'Raise it back up by contracting the obliques',
      'Keep your body in one plane — don’t rotate forward',
    ],
  },
  dragonFlag: {
    name: 'Dragon flag', muscle: 'Obliques (internal)', equip: 'body',
    video: 'dragon flag core form',
    cue: 'Body straight, lower slowly',
    alts: ['copenhagenPlank', 'sidePlankHipDrop', 'cableWoodchopLow'],
    form: [
      'Lie on a bench, grip behind your head for support',
      'Raise your whole body to vertical, then lower it as one straight line',
      'Brace hard — the core resists your body folding',
      'Bend the knees to regress; keep the lower back from arching',
    ],
  },
  serratusPunch: {
    name: 'Cable serratus punch', muscle: 'Serratus', equip: 'cable',
    video: 'cable serratus punch protraction form',
    cue: 'Punch forward, reach the shoulder blade',
    alts: ['pushupPlus', 'scaption'],
    form: [
      'Hold a cable at shoulder height, arm bent',
      'Punch straight forward and reach, protracting the shoulder blade',
      'Feel the muscle on the side of your ribs contract',
      'Return under control without shrugging',
    ],
  },
  pushupPlus: {
    name: 'Push-up plus', muscle: 'Serratus', equip: 'body',
    video: 'push up plus serratus form',
    cue: 'At the top, push the floor away further',
    alts: ['serratusPunch', 'scaption'],
    form: [
      'Do a normal push-up',
      'At the top, push the floor away an extra inch — round the upper back',
      'That extra protraction maximally recruits the serratus',
      'Keep your core braced; don’t sag the hips',
    ],
  },
  scaption: {
    name: 'Scaption raise', muscle: 'Serratus', equip: 'dumbbell',
    video: 'scaption raise shoulder form',
    cue: 'Raise at 45°, thumbs up',
    alts: ['serratusPunch', 'pushupPlus'],
    form: [
      'Light dumbbells, arms at about 45° between front and side',
      'Raise in that scapular plane with thumbs up',
      'Stop at shoulder height',
      'Lower slowly; great for shoulder health',
    ],
  },

  /* ---------- forearms ---------- */
  barbellWristCurl: {
    name: 'Barbell wrist curl', muscle: 'Forearms (flexors)', equip: 'barbell',
    video: 'barbell wrist curl flexors form',
    cue: 'Forearms on thighs, curl the wrists up',
    alts: ['dbWristCurl', 'cableWristCurl'],
    form: [
      'Sit with forearms on your thighs, palms up, bar in your hands',
      'Let the bar roll to your fingertips for a full stretch',
      'Curl the bar up by flexing the wrists and fingers',
      'High reps — the flexors are slow-twitch dominant',
    ],
  },
  dbWristCurl: {
    name: 'Dumbbell wrist curl', muscle: 'Forearms (flexors)', equip: 'dumbbell',
    video: 'dumbbell wrist curl form',
    cue: 'Palms up, full range',
    alts: ['barbellWristCurl', 'cableWristCurl'],
    form: [
      'Forearm on your thigh, palm up, dumbbell in hand',
      'Lower to a full stretch, then curl the wrist up',
      'Control both directions',
      'Train one arm at a time for a better feel',
    ],
  },
  cableWristCurl: {
    name: 'Cable wrist curl', muscle: 'Forearms (flexors)', equip: 'cable',
    video: 'cable wrist curl flexors form',
    cue: 'Constant tension at the stretch',
    alts: ['barbellWristCurl', 'dbWristCurl'],
    form: [
      'Kneel at a low pulley, forearms on a bench, palms up',
      'Let the wrists extend to a full stretch against the cable',
      'Curl up — the cable holds tension at the lengthened position',
      'Squeeze at the top, lower slowly',
    ],
  },
  reverseWristCurl: {
    name: 'Reverse wrist curl (barbell)', muscle: 'Forearms (extensors)', equip: 'barbell',
    video: 'reverse wrist curl extensors form',
    cue: 'Palms down, lift the knuckles',
    alts: ['dbReverseWristCurl', 'cableReverseWristCurl'],
    form: [
      'Forearms on your thighs, palms down, light bar',
      'Lift the back of your hands toward you by extending the wrists',
      'Go much lighter than wrist curls — extensors are weaker',
      'Control the lower; important for elbow health',
    ],
  },
  dbReverseWristCurl: {
    name: 'Dumbbell reverse wrist curl', muscle: 'Forearms (extensors)', equip: 'dumbbell',
    video: 'dumbbell reverse wrist curl form',
    cue: 'One arm, palm down',
    alts: ['reverseWristCurl', 'cableReverseWristCurl'],
    form: [
      'Forearm on your thigh, palm down, light dumbbell',
      'Extend the wrist to lift the back of the hand',
      'Easier to feel and control one arm at a time',
      'Keep it light and controlled',
    ],
  },
  cableReverseWristCurl: {
    name: 'Cable reverse wrist curl', muscle: 'Forearms (extensors)', equip: 'cable',
    video: 'cable reverse wrist curl extensors form',
    cue: 'Constant tension, palms down',
    alts: ['reverseWristCurl', 'dbReverseWristCurl'],
    form: [
      'Low pulley, forearms braced, palms down',
      'Extend the wrists up against the cable',
      'The cable keeps even tension through the range',
      'Slow and controlled — these are small muscles',
    ],
  },
  cableHammerCurl: {
    name: 'Cable hammer curl (rope)', muscle: 'Biceps (brachialis)', equip: 'cable',
    video: 'cable hammer curl rope form',
    cue: 'Neutral rope grip, constant tension',
    alts: ['hammerCurl', 'crossBodyHammer', 'reverseCurl'],
    form: [
      'Rope on a low pulley, neutral grip (palms facing)',
      'Curl up keeping the wrists neutral',
      'The cable gives smooth tension vs. dumbbell gravity',
      'Squeeze the brachialis and forearm, lower slowly',
    ],
  },
};

/* ================= program templates =================
   Slots pick a LIB key per equipment preference and experience level:
   - key:     pick for "mixed" preference (object = per-level pick)
   - free:    pick when the profile prefers free weights
   - machine: pick when the profile prefers machines
   `names` renames specific resolved keys (keeps history matched);
   `noteIfKey`/`mediaWeeks13` only apply when that key is resolved.

   Days are composed from shared slot definitions per gender, one
   template per training split. A body-focus transform then reorders
   each day around the chosen region and shifts volume toward it. */

export const LEVELS = ['beginner', 'intermediate', 'advanced'];
export const EQUIPMENT = ['mixed', 'free', 'machine'];
export const SPLITS = ['full', 'ul', 'five', 'ppl', 'lower', 'upper'];
export const FOCUS = ['balanced', 'lower', 'upper'];

// days/week each split runs (also the count of day cards shown)
export const SPLIT_DAYS = { full: 3, ul: 4, five: 5, ppl: 6, lower: 3, upper: 3 };

const PRIORITY_NOTE = 'Priority lift — first, while fresh';

/* ---------- female slots (glute priority, hypertrophy ranges) ---------- */
const F = {
  squat: { key: 'backSquat', machine: 'hackSquat', sets: 3, repMin: 5, repMax: 12, rest: 180,
    note: 'Goblet squat weeks 1–3', noteIfKey: 'backSquat', mediaWeeks13: 'Goblet_Squat' },
  hipThrust3: { key: 'hipThrust', machine: 'gluteKickback', sets: 3, repMin: 5, repMax: 12, rest: 180 },
  hipThrust4: { key: 'hipThrust', machine: 'gluteKickback', sets: 3, repMin: 5, repMax: 12, rest: 180, note: PRIORITY_NOTE },
  rdl: { key: 'rdl', free: { beginner: 'dbRdl', intermediate: 'rdl', advanced: 'rdl' },
    machine: 'lyingLegCurl', sets: 3, repMin: 5, repMax: 12, rest: 180,
    names: { rdl: 'Romanian deadlift (RDL)' } },
  legCurl: { key: 'seatedLegCurl', free: 'dbRdl', sets: 2, repMin: 5, repMax: 12, rest: 180,
    names: { seatedLegCurl: 'Leg curl (seated)' } },
  abduction: { key: 'hipAbduction', sets: 2, repMin: 5, repMax: 12, rest: 180,
    names: { hipAbduction: 'Bad girls (hip abduction)' } },
  legPressHW: { key: 'legPress', free: 'lunge', sets: 3, repMin: 5, repMax: 12, rest: 180,
    names: { legPress: 'Leg press (feet high & wide)' } },
  legExt: { key: 'legExtension', sets: 3, repMin: 5, repMax: 12, rest: 180 },
  standCalf: { key: 'standingCalf', sets: 2, repMin: 5, repMax: 12, rest: 180 },
  seatCalf: { key: 'seatedCalf', sets: 2, repMin: 5, repMax: 12, rest: 180 },
  chest: { key: { beginner: 'chestPressMachine', intermediate: 'dbBenchPress', advanced: 'dbBenchPress' },
    free: 'dbBenchPress', machine: 'chestPressMachine', sets: 3, repMin: 5, repMax: 12, rest: 180 },
  incline: { key: { beginner: 'inclineDbPress', intermediate: 'inclineDbPress', advanced: 'inclineBarbell' },
    free: { beginner: 'inclineDbPress', intermediate: 'inclineDbPress', advanced: 'inclineBarbell' },
    machine: 'inclineSmith', sets: 3, repMin: 5, repMax: 12, rest: 180 },
  row: { key: 'seatedCableRow', free: 'dbRow', sets: 3, repMin: 5, repMax: 12, rest: 180 },
  pulldown: { key: 'latPulldown', free: { beginner: 'dbRow', intermediate: 'barbellRow', advanced: 'pullup' },
    sets: 3, repMin: 5, repMax: 12, rest: 180 },
  shoulderPress: { key: 'dbShoulderPress', machine: 'machineShoulderPress', sets: 3, repMin: 5, repMax: 12, rest: 180 },
  shoulderPress3: { key: 'dbShoulderPress', machine: 'machineShoulderPress', sets: 3, repMin: 5, repMax: 12, rest: 180 },
  lateral: { key: 'lateralRaise', sets: 3, repMin: 5, repMax: 12, rest: 180 },
  rearDelt: { key: 'facePull', machine: 'reversePecDeck', sets: 3, repMin: 5, repMax: 12, rest: 180 },
  biceps: { key: 'bicepsCurl', machine: 'cableCurl', sets: 3, repMin: 5, repMax: 12, rest: 180 },
  biceps3: { key: 'bicepsCurl', machine: 'cableCurl', sets: 3, repMin: 5, repMax: 12, rest: 180 },
  bicepsLong: { key: 'preacherCurl', machine: 'machinePreacher', sets: 3, repMin: 5, repMax: 12, rest: 180 },
  triceps: { key: 'tricepsPushdown', sets: 3, repMin: 5, repMax: 12, rest: 180 },
  triceps3: { key: 'tricepsPushdown', sets: 3, repMin: 5, repMax: 12, rest: 180 },
  overheadTri: { key: 'overheadTriceps', sets: 3, repMin: 5, repMax: 12, rest: 180 },
  crunch: { key: 'crunch', sets: 2, repMin: 5, repMax: 12, rest: 180 },
};

/* ---------- male slots (size + strength ranges) ---------- */
const M = {
  squat: { key: { beginner: 'gobletSquat', intermediate: 'backSquat', advanced: 'backSquat' },
    free: { beginner: 'gobletSquat', intermediate: 'backSquat', advanced: 'backSquat' },
    machine: 'hackSquat', sets: 3, repMin: 5, repMax: 12, rest: 180, note: PRIORITY_NOTE },
  rdl4: { key: 'rdl', free: { beginner: 'dbRdl', intermediate: 'rdl', advanced: 'rdl' },
    machine: 'lyingLegCurl', sets: 3, repMin: 5, repMax: 12, rest: 180,
    note: PRIORITY_NOTE, names: { rdl: 'Romanian deadlift (RDL)' } },
  bench: { key: { beginner: 'dbBenchPress', intermediate: 'barbellBench', advanced: 'barbellBench' },
    free: { beginner: 'dbBenchPress', intermediate: 'barbellBench', advanced: 'barbellBench' },
    machine: 'chestPressMachine', sets: 3, repMin: 5, repMax: 12, rest: 180 },
  bench4: { key: { beginner: 'dbBenchPress', intermediate: 'barbellBench', advanced: 'barbellBench' },
    free: { beginner: 'dbBenchPress', intermediate: 'barbellBench', advanced: 'barbellBench' },
    machine: 'chestPressMachine', sets: 3, repMin: 5, repMax: 12, rest: 180, note: PRIORITY_NOTE },
  row: { key: 'seatedCableRow', free: { beginner: 'dbRow', intermediate: 'barbellRow', advanced: 'barbellRow' },
    sets: 3, repMin: 5, repMax: 12, rest: 180 },
  pulldown: { key: 'latPulldown', free: { beginner: 'dbRow', intermediate: 'pullup', advanced: 'pullup' },
    sets: 3, repMin: 5, repMax: 12, rest: 180 },
  pulldown4: { key: 'latPulldown', free: { beginner: 'dbRow', intermediate: 'pullup', advanced: 'pullup' },
    sets: 3, repMin: 5, repMax: 12, rest: 180, note: PRIORITY_NOTE },
  ohp: { key: { beginner: 'dbShoulderPress', intermediate: 'ohp', advanced: 'ohp' },
    free: { beginner: 'dbShoulderPress', intermediate: 'ohp', advanced: 'ohp' },
    machine: 'machineShoulderPress', sets: 3, repMin: 5, repMax: 12, rest: 180 },
  legCurl: { key: 'seatedLegCurl', free: 'dbRdl', sets: 3, repMin: 5, repMax: 12, rest: 180,
    names: { seatedLegCurl: 'Leg curl (seated)' } },
  legCurl2: { key: 'seatedLegCurl', free: 'dbRdl', sets: 2, repMin: 5, repMax: 12, rest: 180,
    names: { seatedLegCurl: 'Leg curl (seated)' } },
  hack: { key: 'hackSquat', free: 'lunge', sets: 3, repMin: 5, repMax: 12, rest: 180 },
  legPress: { key: 'legPress', free: 'lunge', sets: 3, repMin: 5, repMax: 12, rest: 180 },
  legExt: { key: 'legExtension', sets: 3, repMin: 5, repMax: 12, rest: 180 },
  hipThrust2: { key: 'hipThrust', machine: 'gluteKickback', sets: 2, repMin: 5, repMax: 12, rest: 180 },
  hipThrust3: { key: 'hipThrust', machine: 'gluteKickback', sets: 3, repMin: 5, repMax: 12, rest: 180 },
  chest3: { key: { beginner: 'dbBenchPress', intermediate: 'barbellBench', advanced: 'barbellBench' },
    free: { beginner: 'dbBenchPress', intermediate: 'barbellBench', advanced: 'barbellBench' },
    machine: 'chestPressMachine', sets: 3, repMin: 5, repMax: 12, rest: 180 },
  incline: { key: { beginner: 'inclineDbPress', intermediate: 'inclineBarbell', advanced: 'inclineBarbell' },
    free: { beginner: 'inclineDbPress', intermediate: 'inclineBarbell', advanced: 'inclineBarbell' },
    machine: 'inclineSmith', sets: 3, repMin: 5, repMax: 12, rest: 180 },
  ohp3: { key: { beginner: 'dbShoulderPress', intermediate: 'ohp', advanced: 'ohp' },
    free: { beginner: 'dbShoulderPress', intermediate: 'ohp', advanced: 'ohp' },
    machine: 'machineShoulderPress', sets: 3, repMin: 5, repMax: 12, rest: 180 },
  standCalf: { key: 'standingCalf', sets: 2, repMin: 5, repMax: 12, rest: 180 },
  seatCalf: { key: 'seatedCalf', sets: 2, repMin: 5, repMax: 12, rest: 180 },
  lateral: { key: 'lateralRaise', sets: 3, repMin: 5, repMax: 12, rest: 180 },
  lateral3: { key: 'lateralRaise', sets: 3, repMin: 5, repMax: 12, rest: 180 },
  rearDelt: { key: 'facePull', machine: 'reversePecDeck', sets: 3, repMin: 5, repMax: 12, rest: 180 },
  biceps: { key: 'bicepsCurl', machine: 'cableCurl', sets: 3, repMin: 5, repMax: 12, rest: 180 },
  biceps3: { key: 'bicepsCurl', machine: 'cableCurl', sets: 3, repMin: 5, repMax: 12, rest: 180 },
  bicepsLong: { key: 'preacherCurl', machine: 'machinePreacher', sets: 3, repMin: 5, repMax: 12, rest: 180 },
  triceps: { key: 'tricepsPushdown', sets: 3, repMin: 5, repMax: 12, rest: 180 },
  triceps3: { key: 'tricepsPushdown', sets: 3, repMin: 5, repMax: 12, rest: 180 },
  overheadTri: { key: 'overheadTriceps', sets: 3, repMin: 5, repMax: 12, rest: 180 },
  crunch: { key: 'crunch', sets: 2, repMin: 5, repMax: 12, rest: 180 },
};

const day = (name, focus, optional, exercises) => ({ name, focus, optional, exercises });
// tag a slot as part of superset group `g` (copies so shared slots aren't mutated)
const ss = (g, slot) => Object.assign({}, slot, { ssGroup: g });

const TEMPLATES = {
  female: {
    // 3 days · A & B mandatory, C optional bonus
    full: {
      A: day('Day A', 'Squat focus', false, [F.squat, F.hipThrust3, F.chest, F.row, F.legCurl, F.standCalf]),
      B: day('Day B', 'Hip thrust focus', false, [F.hipThrust4, F.rdl, F.pulldown, F.shoulderPress, F.rearDelt, F.abduction, F.seatCalf]),
      C: day('Day C', 'Bonus day', true, [F.legPressHW, F.abduction, F.lateral, F.rearDelt, ss('arms', F.biceps), ss('arms', F.bicepsLong), ss('arms', F.triceps), ss('arms', F.overheadTri), F.crunch]),
    },
    // 4 days · lower / upper / lower / upper
    ul: {
      A: day('Day A', 'Lower body', false, [F.hipThrust4, F.squat, F.rdl, F.abduction, F.standCalf]),
      B: day('Day B', 'Upper body', false, [F.chest, F.pulldown, F.shoulderPress3, F.rearDelt, ss('arms', F.biceps), ss('arms', F.bicepsLong), ss('arms', F.triceps), ss('arms', F.overheadTri)]),
      C: day('Day C', 'Lower body', false, [F.hipThrust3, F.legPressHW, F.legCurl, F.abduction, F.seatCalf]),
      D: day('Day D', 'Upper body', false, [F.row, F.incline, F.lateral, F.rearDelt, ss('arms', F.biceps), ss('arms', F.bicepsLong), ss('arms', F.triceps), ss('arms', F.overheadTri)]),
    },
    // 5 days · lower / upper / push / pull / legs
    five: {
      A: day('Day A', 'Lower body', false, [F.hipThrust4, F.squat, F.rdl, F.abduction, F.standCalf]),
      B: day('Day B', 'Upper body', false, [F.chest, F.pulldown, F.shoulderPress, F.rearDelt, ss('arms', F.biceps), ss('arms', F.bicepsLong), ss('arms', F.triceps), ss('arms', F.overheadTri)]),
      C: day('Day C', 'Push', false, [F.incline, F.shoulderPress3, F.lateral, F.rearDelt, F.triceps3, F.overheadTri]),
      D: day('Day D', 'Pull', false, [F.pulldown, F.row, F.biceps3, F.bicepsLong, F.crunch]),
      E: day('Day E', 'Legs (glutes)', false, [F.hipThrust4, F.legPressHW, F.legExt, F.rdl, F.seatCalf]),
    },
    // 6 days · push / pull / legs ×2
    ppl: {
      A: day('Day A', 'Push', false, [F.chest, F.shoulderPress3, F.lateral, F.rearDelt, F.triceps3, F.overheadTri]),
      B: day('Day B', 'Pull', false, [F.pulldown, F.row, F.biceps3, F.bicepsLong, F.crunch]),
      C: day('Day C', 'Legs', false, [F.hipThrust4, F.squat, F.rdl, F.abduction, F.standCalf]),
      D: day('Day D', 'Push', false, [F.incline, F.shoulderPress3, F.lateral, F.rearDelt, F.triceps3, F.overheadTri]),
      E: day('Day E', 'Pull', false, [F.pulldown, F.row, F.biceps3, F.bicepsLong, F.crunch]),
      F: day('Day F', 'Legs', false, [F.hipThrust4, F.legPressHW, F.legExt, F.rdl, F.seatCalf]),
    },
    // 3 days · lower body only
    lower: {
      A: day('Day A', 'Squat focus', false, [F.squat, F.hipThrust3, F.rdl, F.abduction, F.standCalf, F.crunch]),
      B: day('Day B', 'Hip thrust focus', false, [F.hipThrust4, F.legPressHW, F.legCurl, F.abduction, F.seatCalf, F.crunch]),
      C: day('Day C', 'Glute focus', false, [F.hipThrust4, F.squat, F.rdl, F.abduction, F.standCalf]),
    },
    // 3 days · upper body only
    upper: {
      A: day('Day A', 'Push focus', false, [F.chest, F.shoulderPress3, F.pulldown, F.lateral, F.rearDelt, F.triceps3, F.overheadTri]),
      B: day('Day B', 'Pull focus', false, [F.pulldown, F.row, F.chest, F.biceps3, F.bicepsLong, F.triceps3, F.overheadTri]),
      C: day('Day C', 'Arms & shoulders', false, [F.shoulderPress3, F.row, F.lateral, F.rearDelt, ss('arms', F.biceps3), ss('arms', F.bicepsLong), ss('arms', F.triceps3), ss('arms', F.overheadTri)]),
    },
  },
  male: {
    full: {
      A: day('Day A', 'Squat focus', false, [M.squat, M.bench, M.row, M.legCurl, M.standCalf]),
      B: day('Day B', 'Deadlift focus', false, [M.rdl4, M.pulldown, M.ohp, M.rearDelt, M.hack, M.seatCalf]),
      C: day('Day C', 'Bonus day', true, [M.legPress, M.lateral, M.rearDelt, ss('arms', M.biceps), ss('arms', M.bicepsLong), ss('arms', M.triceps), ss('arms', M.overheadTri), M.hipThrust2, M.crunch]),
    },
    ul: {
      A: day('Day A', 'Lower body', false, [M.squat, M.rdl4, M.legExt, M.legCurl2, M.standCalf]),
      B: day('Day B', 'Upper body', false, [M.bench, M.pulldown, M.ohp3, M.rearDelt, ss('arms', M.biceps), ss('arms', M.bicepsLong), ss('arms', M.triceps), ss('arms', M.overheadTri)]),
      C: day('Day C', 'Lower body', false, [M.rdl4, M.hack, M.legCurl, M.legExt, M.seatCalf]),
      D: day('Day D', 'Upper body', false, [M.row, M.incline, M.lateral, M.rearDelt, ss('arms', M.biceps3), ss('arms', M.bicepsLong), ss('arms', M.triceps3), ss('arms', M.overheadTri)]),
    },
    five: {
      A: day('Day A', 'Lower body', false, [M.squat, M.rdl4, M.legExt, M.legCurl2, M.standCalf]),
      B: day('Day B', 'Upper body', false, [M.bench, M.pulldown, M.ohp3, M.rearDelt, ss('arms', M.biceps), ss('arms', M.bicepsLong), ss('arms', M.triceps), ss('arms', M.overheadTri)]),
      C: day('Day C', 'Push', false, [M.bench4, M.ohp3, M.lateral, M.rearDelt, M.triceps3, M.overheadTri]),
      D: day('Day D', 'Pull', false, [M.pulldown4, M.row, M.biceps3, M.bicepsLong, M.crunch]),
      E: day('Day E', 'Legs', false, [M.hack, M.rdl4, M.legExt, M.seatCalf]),
    },
    ppl: {
      A: day('Day A', 'Push', false, [M.bench4, M.ohp3, M.lateral, M.rearDelt, M.triceps3, M.overheadTri]),
      B: day('Day B', 'Pull', false, [M.pulldown4, M.row, M.biceps3, M.bicepsLong, M.crunch]),
      C: day('Day C', 'Legs', false, [M.squat, M.rdl4, M.legExt, M.standCalf]),
      D: day('Day D', 'Push', false, [M.incline, M.ohp3, M.lateral3, M.rearDelt, M.triceps3, M.overheadTri]),
      E: day('Day E', 'Pull', false, [M.pulldown4, M.row, M.biceps3, M.bicepsLong, M.crunch]),
      F: day('Day F', 'Legs', false, [M.legPress, M.rdl4, M.legCurl, M.legExt, M.seatCalf]),
    },
    lower: {
      A: day('Day A', 'Squat focus', false, [M.squat, M.rdl4, M.legExt, M.legCurl, M.standCalf, M.crunch]),
      B: day('Day B', 'Deadlift focus', false, [M.rdl4, M.hack, M.legExt, M.hipThrust3, M.seatCalf]),
      C: day('Day C', 'Legs', false, [M.legPress, M.rdl4, M.legExt, M.legCurl, M.standCalf, M.crunch]),
    },
    upper: {
      A: day('Day A', 'Push focus', false, [M.bench4, M.ohp3, M.pulldown, M.lateral, M.rearDelt, M.triceps3, M.overheadTri]),
      B: day('Day B', 'Pull focus', false, [M.pulldown4, M.row, M.chest3, M.biceps3, M.bicepsLong, M.triceps3, M.overheadTri]),
      C: day('Day C', 'Arms & shoulders', false, [M.ohp3, M.row, M.lateral3, M.rearDelt, ss('arms', M.biceps3), ss('arms', M.bicepsLong), ss('arms', M.triceps3), ss('arms', M.overheadTri)]),
    },
  },
};

const DAY_ORDER = ['A', 'B', 'C', 'D', 'E', 'F'];
export const STYLES = ['full', 'ul', 'ppl']; // split styles (separate from day count)

// Resolve the program shape. A "Specialize" choice (lower/upper only) gives a
// fixed 3-day single-region template; otherwise the chosen style's day pool is
// composed across the chosen number of days.
function shapeOf(profile) {
  const p = profile || {};
  const g = p.gender === 'male' ? 'male' : 'female';
  if (p.spec === 'lower' || p.spec === 'upper') {
    const tpl = TEMPLATES[g][p.spec];
    const keys = Object.keys(tpl);
    return { g, pool: keys.map(k => tpl[k]), count: keys.length, variant: p.spec };
  }
  const style = STYLES.includes(p.style) ? p.style : 'full';
  const tpl = TEMPLATES[g][style];
  const pool = Object.keys(tpl).map(k => tpl[k]);
  const count = Math.max(2, Math.min(6, p.days || 3));
  return { g, pool, count, variant: style + count };
}

// ordered day keys for a profile (A..N for the chosen day count)
export function dayKeys(profile) {
  return DAY_ORDER.slice(0, shapeOf(profile).count);
}

function resolveKey(slot, profile) {
  let pick = slot.key;
  if (profile.equipment === 'free' && slot.free) pick = slot.free;
  else if (profile.equipment === 'machine' && slot.machine) pick = slot.machine;
  if (typeof pick === 'object') pick = pick[profile.level] || pick.beginner;
  return pick;
}

function regionOf(key) {
  const m = LIB[key].muscle;
  if (m === 'Abs') return 'core';
  return /Chest|Back|Shoulders|delts|Biceps|Triceps/.test(m) ? 'upper' : 'lower';
}

// simplified muscle group for a movement (for the day's focus label)
export function groupOf(key) {
  const m = LIB[key].muscle.toLowerCase();
  if (m.includes('quad')) return 'Quads';
  if (m.includes('glute')) return 'Glutes';
  if (m.includes('hamstring')) return 'Hamstrings';
  if (m.includes('calf') || m.includes('calves')) return 'Calves';
  if (m.includes('inner thigh') || m.includes('adduct')) return 'Adductors';
  if (m.includes('chest')) return 'Chest';
  if (m.includes('back') || m.includes('lats') || m.includes('trap')) return 'Back';
  if (m.includes('shoulder') || m.includes('delt')) return 'Shoulders';
  if (m.includes('bicep')) return 'Biceps';
  if (m.includes('tricep')) return 'Triceps';
  if (m.includes('ab') || m.includes('obliq')) return 'Abs';
  if (m.includes('forearm')) return 'Forearms';
  if (m.includes('serratus')) return 'Shoulders';
  return LIB[key].muscle;
}

// the day's muscle focus: top groups by set volume, e.g. "Glutes · Quads · Hams"
function dayMuscles(exercises) {
  const totals = {};
  for (const e of exercises) totals[groupOf(e.key)] = (totals[groupOf(e.key)] || 0) + e.sets;
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([g]) => g === 'Hamstrings' ? 'Hams' : g)
    .join(' · ');
}

// Goal transform: strength = lower reps + longer rest on compounds; hypertrophy
// (default) keeps the growth-oriented ranges. Compounds = rest ≥ 180s.
function applyGoal(ex, goal) {
  if (goal !== 'strength') return ex;
  const compound = ex.rest >= 180;
  return Object.assign({}, ex, {
    repMin: compound ? 3 : 6,
    repMax: compound ? 6 : 10,
    rest: compound ? Math.max(ex.rest, 210) : Math.max(ex.rest, 90),
  });
}

// Canonical "head" of a movement: the muscle group plus the specific head
// named in parens, so a swap can target the exact same head and not just the
// overall muscle. Compound lifts (e.g. "Hamstrings & glutes") form their own
// bucket. e.g. "Chest (upper)" -> "chest:upper", "Chest" -> "chest".
export function headOf(key) {
  const m = LIB[key].muscle;
  const paren = (m.match(/\(([^)]+)\)/) || [])[1];
  const base = m.replace(/\s*\([^)]*\)/, '').trim().toLowerCase();
  return paren ? base + ':' + paren.toLowerCase() : base;
}

// pick an accessory for a focused group: same group, not already in the day,
// favouring the equipment preference. Returns a LIB key or null.
function focusAccessory(group, used, profile) {
  const cands = Object.keys(LIB).filter(k => groupOf(k) === group && !used.has(k));
  if (!cands.length) return null;
  const eq = profile.equipment;
  const fits = k => {
    const e = LIB[k].equip;
    if (eq === 'machine') return e === 'machine' || e === 'cable';
    if (eq === 'free') return e !== 'machine' && e !== 'cable';
    return true;
  };
  cands.sort((a, b) => (fits(b) ? 1 : 0) - (fits(a) ? 1 : 0));
  return cands[0];
}

// Muscle focus: rather than piling sets onto existing lifts (sets are capped),
// each chosen group that's trained that day gets one extra accessory exercise,
// concentrating volume where the user wants it via more movements.
function applyMuscleFocus(exercises, focusList, profile) {
  if (!focusList || !focusList.length) return exercises;
  const used = new Set(exercises.map(e => e.key));
  const adds = [];
  for (const group of focusList) {
    if (!exercises.some(e => groupOf(e.key) === group)) continue; // not trained today
    const key = focusAccessory(group, used, profile);
    if (!key) continue;
    used.add(key);
    adds.push(applyGoal({
      key, name: LIB[key].name, sets: 3, repMin: 8, repMax: 12, rest: 180,
      note: 'Focus — extra ' + group.toLowerCase() + ' work',
    }, profile.goal));
  }
  return exercises.concat(adds);
}

// Body focus: the focused region trains first and gets +1 set on its
// lead slot; the other region's slots are trimmed to 2 sets (core untouched).
function applyFocus(exercises, focus) {
  if (focus !== 'lower' && focus !== 'upper') return exercises;
  const focused = exercises.filter(e => regionOf(e.key) === focus);
  const rest = exercises.filter(e => regionOf(e.key) !== focus);
  if (!focused.length) return exercises; // single-region day for the other side
  focused[0] = Object.assign({}, focused[0], { sets: focused[0].sets + 1 });
  const trimmed = rest.map(e => regionOf(e.key) === 'core' ? e : Object.assign({}, e, { sets: Math.min(e.sets, 2) }));
  return focused.concat(trimmed);
}

// Reorder so no two consecutive exercises hit the same muscle group, keeping
// the lead lift first and superset pairs together. Greedy + stable: always
// take the earliest remaining block whose group differs from the last placed.
function avoidAdjacent(exercises) {
  const blocks = [];
  for (const e of exercises) {
    const prev = blocks[blocks.length - 1];
    if (e.ssGroup && prev && prev.ss === e.ssGroup) prev.items.push(e);
    else blocks.push({ ss: e.ssGroup, items: [e], group: groupOf(e.key) });
  }
  const out = [];
  const rem = blocks.slice();
  let lastGroup = null;
  while (rem.length) {
    let idx = rem.findIndex(b => b.group !== lastGroup);
    if (idx === -1) idx = 0; // everything left clashes — just take the next
    const b = rem.splice(idx, 1)[0];
    out.push(...b.items);
    lastGroup = groupOf(b.items[b.items.length - 1].key);
  }
  return out;
}

// stable id for a day-slot, used to persist a custom exercise override
export function overrideKey(profile, day, idx) {
  const p = profile || {};
  return (p.gender === 'male' ? 'm' : 'f') + '|' + shapeOf(p).variant + '|' + day + '|' + idx;
}

// Build the concrete program for a profile. The UI never labels the
// variants — the program just quietly fits the person. `custom` holds
// persistent per-slot exercise overrides (the Meso Builder). The chosen
// split style's day pool is composed across the chosen day count.
export function programFor(profile, custom, extras, removed) {
  const p = Object.assign(
    { gender: 'female', level: 'beginner', equipment: 'mixed', style: 'full', days: 3, focus: 'balanced', spec: 'off', goal: 'hypertrophy', muscleFocus: [] },
    profile || {});
  const shape = shapeOf(p);
  const out = {};
  shape.pool.length && dayKeys(p).forEach((d, i) => {
    const src = shape.pool[i % shape.pool.length];
    // resolve to base exercises (no override yet) so reordering is stable
    let exercises = src.exercises.map(slot => {
      const key = resolveKey(slot, p);
      return applyGoal({
        key,
        name: (slot.names && slot.names[key]) || LIB[key].name,
        sets: slot.sets,
        repMin: slot.repMin,
        repMax: slot.repMax,
        rest: slot.rest,
        note: (!slot.noteIfKey || slot.noteIfKey === key) ? slot.note : undefined,
        mediaWeeks13: key === 'backSquat' ? slot.mediaWeeks13 : undefined,
        ssGroup: slot.ssGroup,
      }, p.goal);
    });
    exercises = avoidAdjacent(applyMuscleFocus(applyFocus(exercises, p.focus), p.muscleFocus, p));
    // apply Meso Builder overrides by final position (matches the swap UI index)
    exercises = exercises.map((e, idx) => {
      const ov = custom && custom[overrideKey(p, d, idx)];
      return (ov && LIB[ov] && ov !== e.key) ? Object.assign({}, e, { key: ov, name: LIB[ov].name }) : e;
    });
    // exercises the user removed from this day stay removed (saved day list)
    const rmv = removed && removed[d];
    if (rmv && rmv.length) {
      const drop = new Set(rmv);
      exercises = exercises.filter(e => !drop.has(e.key));
    }
    // user-added exercises for this day, always appended after the planned slots
    const extra = extras && extras[d];
    if (extra && extra.length) {
      for (const key of extra) {
        if (!LIB[key]) continue;
        exercises.push(applyGoal({
          key, name: LIB[key].name, sets: 3, repMin: 8, repMax: 12, rest: 180,
        }, p.goal));
      }
    }
    out[d] = {
      name: 'Day ' + (i + 1),
      focus: src.focus,
      muscles: dayMuscles(exercises),
      optional: false,
      exercises,
    };
  });
  return out;
}
