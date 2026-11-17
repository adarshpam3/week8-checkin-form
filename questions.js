/* One list of questions, shared by the form (index.html), the dashboard (dashboard.html)
   and the server (api/checkins.js), so all three always agree.
   Types: text (one line), long (paragraph), scale (1-10), one (pick one), many (pick any).
   "note" adds an optional paragraph box under a choice question.
   "warn" marks answers that flag a client for follow-up on the dashboard. */
(function (root) {
  const SECTIONS = [
    {
      title: 'About you',
      qs: [
        { id: 'name', type: 'text', label: 'Your name', placeholder: 'First name', short: 'Name' },
      ],
    },
    {
      title: 'Where you are right now',
      qs: [
        {
          id: 'rating', type: 'scale', required: true, short: 'Happiness', warnBelow: 7,
          label: 'Overall, how happy are you with the coaching?',
          ends: ['1 · Not great', '10 · Loving it'],
        },
        {
          id: 'on_track', type: 'one', short: 'On track lately',
          label: 'Be honest: how on track have you been over the last 2 weeks?',
          options: ['Fully on track', 'Mostly, a few slips', 'Up and down', 'Fallen off', 'Just getting back on'],
          warn: ['Up and down', 'Fallen off'],
        },
        {
          id: 'win', type: 'long', short: 'Biggest win',
          label: "What's your biggest win so far?",
          hint: 'Scale, mirror, energy, strength, sleep, confidence, a habit that finally stuck. Anything counts.',
          placeholder: "e.g. Down 4kg and I'm not crashing at 3pm anymore",
        },
        {
          id: 'motivation', type: 'one', short: 'Motivation vs start',
          label: 'Compared to your first couple of weeks, your motivation is…',
          options: ['Higher', 'About the same', 'A bit lower', 'A lot lower'],
          warn: ['A lot lower'],
        },
        {
          id: 'energy', type: 'one', short: 'Energy',
          label: 'How are your energy levels day to day?',
          options: ['High', 'Okay', 'Low', 'Running on empty'],
          warn: ['Running on empty'],
        },
      ],
    },
    {
      title: 'What pulls you off track',
      intro: "This is the important part. Most people don't fail because of the plan. Life gets in the way. Tell me what it really looks like for you.",
      qs: [
        {
          id: 'triggers', type: 'many', short: 'Pulls off track',
          label: 'What pulls you off track the most?',
          hint: 'Pick all that apply.',
          options: [
            'Drinking or nights out', 'Eating out with family or friends', 'Weekends', 'Family meals I don’t control',
            'People pushing food or drinks on me', 'Work stress or long hours', 'Travel', 'Tired, no energy',
            'Bad sleep', 'Stress or emotional eating', 'Late-night snacking', 'Boredom',
            'Lost motivation', 'No time', 'Injury or illness',
          ],
          note: { id: 'triggers_note', placeholder: 'Anything else that throws you off?' },
        },
        {
          id: 'slip_story', type: 'long', short: 'Last slip',
          label: 'Walk me through the last time you went off plan.',
          hint: 'Where were you, who were you with, how were you feeling before, and what happened after? The more detail, the better I can help.',
          placeholder: 'e.g. Friday after work, drinks with the team, ended up at a burger place, skipped Saturday’s workout because I felt rough…',
        },
        {
          id: 'hard_times', type: 'many', short: 'Hardest times',
          label: 'When is it hardest to stick to the plan?',
          hint: 'Pick all that apply.',
          options: ['Mornings', 'During work', 'Weekday evenings', 'Late at night', 'Friday nights', 'Weekends', 'Holidays and events'],
        },
        {
          id: 'after_slip', type: 'one', short: 'After a slip',
          label: 'When you slip up, what usually happens next?',
          options: [
            'Straight back on track at the next meal',
            'I write off the rest of the day',
            'I write off the week and “start Monday”',
            'I feel guilty and eat too little to make up for it',
            'I go quiet and avoid checking in',
          ],
          warn: ['I write off the week and “start Monday”', 'I feel guilty and eat too little to make up for it', 'I go quiet and avoid checking in'],
        },
        {
          id: 'avoided', type: 'one', short: 'Avoided messaging me',
          label: 'Have you ever avoided messaging me because you were off track?',
          options: ['Never', 'Once or twice', 'Yes, often'],
          warn: ['Yes, often'],
        },
      ],
    },
    {
      title: 'Drinking, eating out and people around you',
      qs: [
        {
          id: 'drinks', type: 'one', short: 'Drinks a week',
          label: 'How many alcoholic drinks in a typical week right now?',
          options: ['None', '1–3', '4–7', '8–14', '15+'],
          warn: ['8–14', '15+'],
          note: { id: 'drinks_note', placeholder: 'When do you usually drink, and what happens with food during or after?' },
        },
        {
          id: 'eating_out', type: 'one', short: 'Eating out a week',
          label: 'How often do you eat out or order in each week?',
          options: ['0', '1–2 times', '3–4 times', '5+ times'],
          note: { id: 'eating_out_note', placeholder: 'Where do you usually go, and what do you usually order?' },
        },
        {
          id: 'social', type: 'one', short: 'People around you',
          label: 'How do the people around you (family, partner, friends, work) react to your goals?',
          options: ['Fully supportive', 'Supportive, but they still tempt me', 'They don’t really notice', 'They make it harder'],
          warn: ['They make it harder'],
          note: { id: 'social_note', placeholder: 'Anyone or any situation in particular?' },
        },
      ],
    },
    {
      title: 'Training, food and recovery',
      qs: [
        {
          id: 'sessions', type: 'one', short: 'Workouts done',
          label: 'Of your planned workouts, how many do you actually get done in a typical week?',
          options: ['All of them', 'Most', 'About half', 'A few', 'None lately'],
          warn: ['A few', 'None lately'],
        },
        {
          id: 'training', type: 'one', short: 'Workouts feel',
          label: 'How do the workouts feel right now?',
          options: ['Too easy', 'Just right', 'Too hard', 'Getting boring'],
          warn: ['Too hard', 'Getting boring'],
        },
        {
          id: 'diet', type: 'one', short: 'Meal plan',
          label: 'How easy is the meal plan to follow?',
          options: ['Easy, fits my life', 'Mostly fine', 'Struggling with it'],
          warn: ['Struggling with it'],
          note: { id: 'diet_note', placeholder: 'Any meals you’re sick of, or foods you want added?' },
        },
        {
          id: 'sleep', type: 'one', short: 'Sleep',
          label: 'How much sleep do you get on a typical night?',
          options: ['Under 5 hours', '5–6 hours', '6–7 hours', '7–8 hours', '8+ hours'],
          warn: ['Under 5 hours'],
        },
        {
          id: 'stress', type: 'one', short: 'Stress',
          label: 'How stressed have you been lately?',
          options: ['Low', 'Moderate', 'High', 'Overwhelmed'],
          warn: ['Overwhelmed'],
        },
      ],
    },
    {
      title: 'Your head',
      qs: [
        {
          id: 'confidence', type: 'scale', short: 'Confidence', warnBelow: 6,
          label: 'How confident are you that you’ll reach your goal?',
          ends: ['1 · Not at all', '10 · No doubt'],
        },
        {
          id: 'why', type: 'long', short: 'Why they started',
          label: 'Why did you start this in the first place? Does that reason still matter to you?',
          placeholder: 'e.g. Wanted to feel good at my sister’s wedding. Still matters, but it feels far away now.',
        },
        {
          id: 'honest', type: 'long', short: 'Honest answer',
          label: 'If you’re completely honest, what are you not doing that you know you should be?',
          placeholder: 'No judgement. This is where the real progress is.',
        },
        {
          id: 'obstacle', type: 'long', short: 'Biggest risk',
          label: 'What’s most likely to get in your way over the next month?',
          placeholder: 'e.g. Two weddings, a work trip, and my birthday',
        },
      ],
    },
    {
      title: 'What you need from me',
      qs: [
        {
          id: 'support', type: 'one', short: 'Check-ins and calls',
          label: 'How useful are the check-ins and calls?',
          options: ['Super useful, keep as is', 'Useful, could be shorter', 'Want more contact', 'Feels like a chore'],
          warn: ['Feels like a chore'],
        },
        {
          id: 'more', type: 'many', short: 'Want more of',
          label: 'What would help you most right now?',
          hint: 'Pick all that apply.',
          options: [
            'A plan for drinks and nights out', 'Eating-out and takeaway guide', 'Tips for family meals and events',
            'Help when motivation drops', 'More accountability', 'Quick, easy recipes', 'Form checks on your lifts',
            'Sleep and stress help', 'Push me harder', 'Faster replies',
          ],
          note: { id: 'more_note', placeholder: 'Anything else you wish I was doing?' },
        },
        {
          id: 'goal', type: 'long', short: 'Next goal',
          label: 'What’s the one thing you want to nail before your next check-in?',
          placeholder: 'e.g. Train 4 times every week, max 2 drinks on weekends, stop snacking at night',
        },
        { id: 'else_', type: 'long', short: 'Anything else', label: 'Anything else on your mind?', placeholder: 'Optional' },
      ],
    },
  ];

  const QUESTIONS = SECTIONS.flatMap((s) => s.qs);
  const schema = { SECTIONS, QUESTIONS };
  if (typeof module !== 'undefined' && module.exports) module.exports = schema;
  else root.CHECKIN = schema;
})(this);
