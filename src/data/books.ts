/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Book } from '../types';

export const BOOKS_DATA: Book[] = [
  {
    id: 1,
    title: "The Art of Thinking",
    author: "Prof. Arthur Pendelton",
    color: "#4a3060",
    lessons: [
      {
        id: "think-1",
        title: "What Is Thought?",
        subtitle: "The cognitive architecture of raw intelligence",
        pages: [
          {
            pageNumber: 1,
            content: `
              <p>Thinking is the silent architecture of the human experience. Before a word is spoken, before a hand moves, the mind has already built and torn down a hundred invisible structures.</p>
              <p>To think is not merely to process information — it is to interpret, to weigh, and to imagine what does not yet exist. Ancient philosophers described thought as the dialogue of the soul with itself, and in that formulation lies a deep truth: thinking is relational, even when we are entirely alone.</p>
              <div class="callout">
                <strong>Smartboard Focus:</strong> Cognitive load refers to the amount of working memory resources used. When instructing on smartboards, dynamic visual scaffolding reduces extraneous cognitive load.
              </div>
              <p>In our modern understanding, cognitive architecture is modelled as a distributed network of neural nodes firing in synchronized temporal rhythms, representing concepts, recollections, and predictions simultaneously.</p>
            `,
            figure: {
              caption: "Figure 1.1: Simplified schema of prefrontal neural activation during semantic association.",
              svgType: "brain"
            }
          },
          {
            pageNumber: 2,
            content: `
              <h2>The Dual Nature of Mind</h2>
              <p>Western tradition has long divided the mind into two camps — the rational and the intuitive. Aristotle called reason the highest faculty; the Romantics celebrated imagination as the truer sight. Both, of course, were right. A mind that reasons without intuition calculates without wisdom; a mind that intuits without reason drifts without anchor.</p>
              <blockquote>The question is not whether you think, but whether you notice that you are thinking — and whether you have learned to watch your own mind with curiosity rather than fear.</blockquote>
              <p>Modern cognitive science has largely confirmed what contemplatives have long known: most of what we call 'thinking' happens beneath conscious awareness. The flash of insight, the sudden solution, the dream that solves the waking problem — these are signs of the mind working invisibly, turning over the problem in the dark.</p>
            `
          }
        ],
        flashQuestions: [
          {
            id: "think-1-q1",
            question: "According to cognitive science, where does the majority of thought processing occur?",
            answer: "Beneath conscious awareness (the cognitive unconscious), processing concepts and associations in parallel.",
            difficulty: "Medium"
          },
          {
            id: "think-1-q2",
            question: "How did Aristotle define the highest faculty of the human mind?",
            answer: "Reason (rational capacity), which he argued was the distinguishing human characteristic.",
            difficulty: "Easy"
          }
        ]
      },
      {
        id: "think-2",
        title: "Logic and Its Limits",
        subtitle: "The structure and boundary of syllogistic reasoning",
        pages: [
          {
            pageNumber: 1,
            content: `
              <p>Logic is the skeleton of reasoning — essential, load-bearing, invisible in the healthy body of thought. Remove it and the mind collapses into superstition. Rely on it alone and you get a structure that is perfectly sound but utterly lifeless.</p>
              <p>The ancient Greeks gave us formal logic: the syllogism, the proposition, and the method of <em>reductio ad absurdum</em>. From these grew mathematics, computer science, and legal frameworks across civilizations.</p>
            `,
            equations: [
              "A \\rightarrow B",
              "B \\rightarrow C",
              "\\therefore A \\rightarrow C"
            ]
          },
          {
            pageNumber: 2,
            content: `
              <h2>Where Logic Falls Short</h2>
              <p>Yet the greatest decisions of a life — whom to love, what to believe, and what to sacrifice — resist the syllogism. They require something that philosophy has called practical wisdom (<em>phronesis</em>). This is not the rejection of logic but its completion.</p>
              <p>Consider the prisoner's dilemma, the paradox of the heap, or Gödel's incompleteness theorems — each demonstrates that even within formal closed systems, logic encounters its own boundary. There are truths that cannot be proven from within the system that contains them.</p>
            `
          }
        ],
        flashQuestions: [
          {
            id: "think-2-q1",
            question: "What is the philosophical term for practical wisdom that operates beyond standard rule-bound logic?",
            answer: "Phronesis, Greek term coined by Aristotle to describe contextual ethical judgment.",
            difficulty: "Hard"
          }
        ]
      }
    ]
  },
  {
    id: 2,
    title: "Rivers of Time",
    author: "Dr. Elena Rostov",
    color: "#1a4a3a",
    lessons: [
      {
        id: "river-1",
        title: "Origins of History",
        subtitle: "How records transformed prehistoric humanity",
        pages: [
          {
            pageNumber: 1,
            content: `
              <p>History begins not with the first human action, but with the first human who thought to <em>record</em> one. The great gap between prehistory and history is not a difference of events, but of evidence — the presence or absence of marks made by minds that wanted to be remembered.</p>
              <p>The earliest historical records — Sumerian clay tablets, Egyptian papyrus scrolls, Shang oracle bones — were not grand tales of adventure. They were tallies, tax documents, inventories, and grain receipts. History, in its absolute dawn, was accounting.</p>
            `,
            figure: {
              caption: "Figure 2.1: Flow and convergence of ancient alluvial civilizations around key river basins.",
              svgType: "river"
            }
          },
          {
            pageNumber: 2,
            content: `
              <h2>The Invention of Narrative</h2>
              <p>The leap from record to story was momentous. When Herodotus set out to preserve the 'great deeds' of Greeks and Persians so they would not decay over time, he did something genuinely new: he argued that the past had meaning, that events did not simply happen but signified.</p>
              <p>Every subsequent historian has worked in the shadow of that ambition and that problem — because to tell a story about the past is always to make choices about what matters, and those choices are never innocent.</p>
              <blockquote>History is the autobiography of a madman written by a committee of blind accountants.</blockquote>
            `
          }
        ],
        flashQuestions: [
          {
            id: "river-1-q1",
            question: "What was the dominant purpose of the earliest Sumerian clay records?",
            answer: "Administrative accounting: tracking grain, tax ledger entries, livestock counts.",
            difficulty: "Easy"
          }
        ]
      }
    ]
  },
  {
    id: 3,
    title: "The Living Planet",
    author: "Prof. Julian Vance",
    color: "#2a5a1a",
    lessons: [
      {
        id: "planet-1",
        title: "Ecosystems and Trophic Cascades",
        subtitle: "The interconnected loops of planetary life",
        pages: [
          {
            pageNumber: 1,
            content: `
              <p>No organism lives in absolute isolation. Every species exists in relation to dozens or hundreds of others — as predator and prey, host and parasite, competitor or collaborator. These webs of relationship, spanning from the microbial to the macroscopic, constitute what we call an ecosystem.</p>
              <div class="callout">
                <strong>Classroom Exercise:</strong> Trace the path of an carbon atom from a decaying leaf back into the atmosphere and finally into the glucose of a healthy rabbit.
              </div>
              <p>The concept of the ecosystem was formalized in the twentieth century, but the underlying insight is ancient: pull on any single strand of nature, and the entire web responds.</p>
            `,
            figure: {
              caption: "Figure 3.1: Simplified feedback loop showing a predator-prey trophic cascade.",
              svgType: "ecosystem"
            }
          },
          {
            pageNumber: 2,
            content: `
              <h2>The Yellowstone Trophic Cascade</h2>
              <p>Consider the famous reintroduction of gray wolves to Yellowstone National Park. Remove the wolves, and the elk population exploded; the elk overgrazed the riverbanks; the willows died; rivers began to erode and lose their path; even the fish and beaver populations plummeted.</p>
              <p>When wolves returned, they hunted the elk, allowing vegetation along riverbanks to recover, beaver dams returned, stabilized banks, filtered water, and revived aquatic habitats. A single apex predator completely remodeled the geography of an entire national park.</p>
              <blockquote>The health of an ecosystem is measured not by its tranquility, but by the density of its collaborative loops.</blockquote>
            `
          }
        ],
        flashQuestions: [
          {
            id: "planet-1-q1",
            question: "What is a 'trophic cascade'?",
            answer: "An ecological phenomenon triggered by the addition or removal of top predators, which propagates down through food webs, altering the entire ecosystem structure.",
            difficulty: "Hard"
          },
          {
            id: "planet-1-q2",
            question: "Which apex predator's return restored the riverbank ecology of Yellowstone?",
            answer: "The gray wolf, by controlling elk overgrazing.",
            difficulty: "Easy"
          }
        ]
      }
    ]
  },
  {
    id: 4,
    title: "Mathematics of Beauty",
    author: "Dr. Evelyn Gauss",
    color: "#5a3a10",
    lessons: [
      {
        id: "math-1",
        title: "The Golden Ratio and Geometric Harmony",
        subtitle: "Exploring visual perfection in natural equations",
        pages: [
          {
            pageNumber: 1,
            content: `
              <p>The unreasonable effectiveness of mathematics in describing physical reality has puzzled scientists for centuries. Why should the abstract patterns discovered by pure mathematicians turning over logic in their heads, predict the physical universe with such flawless precision?</p>
              <p>Galileo famously remarked that the universe is written in the language of mathematics, and its characters are triangles, circles, and other geometric figures, without which it is humanly impossible to understand a single word.</p>
            `,
            equations: [
              "\\Phi = \\frac{1 + \\sqrt{5}}{2} \\approx 1.6180339887",
              "f_n = f_{n-1} + f_{n-2}"
            ],
            figure: {
              caption: "Figure 4.1: Logarithmic spiral formed using successive golden ratio squares.",
              svgType: "math"
            }
          },
          {
            pageNumber: 2,
            content: `
              <h2>Fibonacci Sequences in Nature</h2>
              <p>We see the golden ratio in the seed arrangement of sunflowers, the curves of chambered nautilus shells, and the spiral arms of distant galaxies. It represents the most efficient way to pack elements together tightly without gaps, maximizing exposure to sunlight in plants or load distribution in skeletal branches.</p>
              <p>A mathematical proof is a sequence of logic that changes a default assumption into absolute certainty. When a proof is elegant, it does more than demonstrate truth — it exposes the cosmic architecture of the cosmos.</p>
            `
          }
        ],
        flashQuestions: [
          {
            id: "math-1-q1",
            question: "What is the approximate numerical value of the Golden Ratio?",
            answer: "1.618 (often represented by the Greek letter Phi).",
            difficulty: "Easy"
          },
          {
            id: "math-1-q2",
            question: "How is the Golden Ratio linked to the Fibonacci sequence?",
            answer: "The ratio of consecutive Fibonacci numbers converges to Phi as the numbers progress towards infinity.",
            difficulty: "Medium"
          }
        ]
      }
    ]
  },
  {
    id: 5,
    title: "Philosophy of Mind",
    author: "Prof. Daniel Dennett",
    color: "#3a1a5a",
    lessons: [
      {
        id: "mind-1",
        title: "The Hard Problem",
        subtitle: "Why physical brains give rise to subjective feeling",
        pages: [
          {
            pageNumber: 1,
            content: `
              <p>Why is there something it is like to be you? This question — why physical processes in the brain give rise to subjective conscious experience — is what philosopher David Chalmers coined the 'hard problem' of consciousness.</p>
              <p>We can easily map the physical brain: neurons firing, chemical synapses leaking ions, visual regions processing red wavelengths. Yet, we are left completely in the dark regarding why that structural processing should produce the actual, vibrant <em>feeling</em> of redness.</p>
            `,
            figure: {
              caption: "Figure 5.1: The explanatory gap between neurobiology and subjective experience.",
              svgType: "brain"
            }
          },
          {
            pageNumber: 2,
            content: `
              <h2>Theoretical Solutions</h2>
              <p>Philosophers have proposed several frameworks for this deep mystery:</p>
              <ul>
                <li><strong>Physicalism:</strong> Consciousness is simply what brain processing feels like from the inside. There is no 'extra' magic.</li>
                <li><strong>Dualism:</strong> Mind and matter are two separate fabrics that meet and communicate in the neural pathways.</li>
                <li><strong>Panpsychism:</strong> Subjective awareness is a fundamental building block of all physical matter, appearing at different volumes based on organization.</li>
              </ul>
              <blockquote>The hard problem is the question of why the lights are actually on, rather than the brain just operating completely in the dark.</blockquote>
            `
          }
        ],
        flashQuestions: [
          {
            id: "mind-1-q1",
            question: "Who coined the term 'The Hard Problem of Consciousness'?",
            answer: "David Chalmers, in his seminal 1995 presentation and publications.",
            difficulty: "Medium"
          }
        ]
      }
    ]
  },
  {
    id: 6,
    title: "Music & Emotion",
    author: "Dr. Oliver Sacks",
    color: "#7a1a2a",
    lessons: [
      {
        id: "music-1",
        title: "Why Music Moves Us",
        subtitle: "The neuro-visceral resonance of sound waves",
        pages: [
          {
            pageNumber: 1,
            content: `
              <p>Music is the rare art form that completely bypasses formal language to reach our most primitive and profound feelings. A minor chord, a sudden crescendo, or the resolution of a dissonance changes our breathing and heart rate instantly.</p>
              <div class="callout">
                <strong>Classroom Experiment:</strong> Hum a continuous note, then drop it by minor third intervals. Observe the physical tension shift across the students' shoulders.
              </div>
              <p>The evolutionary origins of music remain highly debated. Some argue it was an evolutionary tool for infant soothing or maternal social bonding, while others view it as a side-product of speech learning.</p>
            `,
            figure: {
              caption: "Figure 6.1: Frequency wave interactions generating clean harmonic intervals.",
              svgType: "music"
            }
          }
        ],
        flashQuestions: [
          {
            id: "music-1-q1",
            question: "Which reward-related brain chemical is released when listening to emotional music?",
            answer: "Dopamine, active in the mesolimbic pathway, particularly during moments of musical climax.",
            difficulty: "Medium"
          }
        ]
      }
    ]
  },
  {
    id: 7,
    title: "Languages of the World",
    author: "Prof. Noam Chomsky",
    color: "#1a3a5a",
    lessons: [
      {
        id: "language-1",
        title: "Language and Cognitive Borders",
        subtitle: "Does our native grammar limit our imagination?",
        pages: [
          {
            pageNumber: 1,
            content: `
              <p>Do different languages shape what we are capable of thinking, or merely what we easily express? The Sapir-Whorf hypothesis has excited thinkers for a century, suggesting that language shapes cognition.</p>
              <p>For example, some aboriginal languages use absolute directions (North, South, East, West) instead of relative directions (Left, Right). As a result, even young children remain perfectly oriented, regardless of whether they are in dark, unfamiliar rooms.</p>
            `,
            figure: {
              caption: "Figure 7.1: Semantic mapping of color categories across different language families.",
              svgType: "language"
            }
          }
        ],
        flashQuestions: [
          {
            id: "lang-1-q1",
            question: "What is the Sapir-Whorf hypothesis?",
            answer: "The theory that the structure of a native language shapes or determines a speaker's cognitive patterns and worldview.",
            difficulty: "Medium"
          }
        ]
      }
    ]
  },
  {
    id: 8,
    title: "Ethics & Justice",
    author: "Dr. John Rawls",
    color: "#3a5a1a",
    lessons: [
      {
        id: "ethics-1",
        title: "The Good Life and Justice",
        subtitle: "Distributing resources under a veil of total ignorance",
        pages: [
          {
            pageNumber: 1,
            content: `
              <p>What do we owe to each other? The question of justice is the core dilemma of civilization: how should the benefits, protections, and duties of a productive society be divided fairly?</p>
              <div class="callout">
                <strong>The Veil of Ignorance:</strong> Imagine designing a society without knowing if you will be born rich, poor, physically disabled, exceptionally skilled, or marginalized.
              </div>
              <p>Under this 'veil of ignorance,' John Rawls argued that rational actors would naturally build safety nets, ensuring that even the most disadvantaged members can live healthy, dignified lives.</p>
            `,
            figure: {
              caption: "Figure 8.1: Structural comparison: Utilitarian balance vs. Rawlsian maximin balance.",
              svgType: "fairness"
            }
          }
        ],
        flashQuestions: [
          {
            id: "ethics-1-q1",
            question: "What is John Rawls' famous safety-net principle called?",
            answer: "The Difference Principle, part of his 'Theory of Justice' designed behind a Veil of Ignorance.",
            difficulty: "Hard"
          }
        ]
      }
    ]
  },
  {
    id: 9,
    title: "The Cosmic Code",
    author: "Dr. Stephen Hawking",
    color: "#1e293b",
    lessons: [
      {
        id: "space-1",
        title: "Architecture of Space",
        subtitle: "Understanding relativity and deep sky mechanics",
        pages: [
          {
            pageNumber: 1,
            content: `
              <p>The universe does not exist in a flat coordinates grid. Space and time are woven together in a seamless four-dimensional fabric known as spacetime.</p>
              <div class="callout">
                <strong>Gravity Well:</strong> Massive objects like stars bend the fabric around them, causing other objects to roll along curved orbits.
              </div>
              <p>When studying black holes, we observe that gravity becomes so intense that even light cannot escape its pull, trapping information inside.</p>
            `,
            figure: {
              caption: "Figure 9.1: Gravitational warping around a high-density stellar nucleus.",
              svgType: "brain"
            }
          }
        ],
        flashQuestions: [
          {
            id: "space-1-q1",
            question: "What is the four-dimensional fabric of gravity called?",
            answer: "Spacetime, introduced in Einstein's General Theory of Relativity.",
            difficulty: "Medium"
          }
        ]
      }
    ]
  },
  {
    id: 10,
    title: "The Digital Brain",
    author: "Prof. Alan Turing",
    color: "#034f84",
    lessons: [
      {
        id: "turing-1",
        title: "Computing Machinery",
        subtitle: "How symbols and logic operate modern computers",
        pages: [
          {
            pageNumber: 1,
            content: `
              <p>Can a machine think? This question was posed by Alan Turing as the starting gate of modern computer systems.</p>
              <p>By mapping logic decisions to abstract state transitions, we can construct universal computing systems capable of executing any algorithm.</p>
            `,
            figure: {
              caption: "Figure 10.1: Transition diagram of a classical Turing tape instruction.",
              svgType: "math"
            }
          }
        ],
        flashQuestions: [
          {
            id: "comp-1-q1",
            question: "What theoretical machine forms the base of all programmable computers?",
            answer: "The Turing Machine, defined by states, an infinite tape, and transition rules.",
            difficulty: "Easy"
          }
        ]
      }
    ]
  },
  {
    id: 11,
    title: "Quantum Symphony",
    author: "Dr. Richard Feynman",
    color: "#6b5b95",
    lessons: [
      {
        id: "quantum-1",
        title: "The Particle Dance",
        subtitle: "Superposition and the subatomic waveforms",
        pages: [
          {
            pageNumber: 1,
            content: `
              <p>In the quantum domain, particle states are not definite. Instead, they exist in a cloud of simultaneous probabilities until observed.</p>
              <p>Superposition allows a quantum bit (qubit) to hold a state of 0 and 1 at the same time, accelerating complex calculations.</p>
            `,
            figure: {
              caption: "Figure 11.1: Wave interference patterns passing through dual micro-apertures.",
              svgType: "music"
            }
          }
        ],
        flashQuestions: [
          {
            id: "quant-1-q1",
            question: "What is the term for a particle existing in multiple states simultaneously?",
            answer: "Superposition, described by wave mechanics equations.",
            difficulty: "Medium"
          }
        ]
      }
    ]
  },
  {
    id: 12,
    title: "Biosphere Horizons",
    author: "Prof. Rachel Carson",
    color: "#1c5a35",
    lessons: [
      {
        id: "bio-1",
        title: "Silent Balances",
        subtitle: "Biodiversity conservation and the warning signs of chemical runoff",
        pages: [
          {
            pageNumber: 1,
            content: `
              <p>Human actions echo down evolutionary ladders. The chemical runoffs from modern agriculture seep deep into aquifers, disrupting local nesting cycles.</p>
              <p>Preserving wilderness zones ensures we keep biological storehouses intact, securing natural balance for generations to come.</p>
            `,
            figure: {
              caption: "Figure 12.1: Food web disruption and toxin loading across ecological levels.",
              svgType: "ecosystem"
            }
          }
        ],
        flashQuestions: [
          {
            id: "bio-1-q1",
            question: "What famous book by Rachel Carson highlighted the dangers of chemical pesticides?",
            answer: "Silent Spring, published in 1962, which sparked the modern environmental movement.",
            difficulty: "Easy"
          }
        ]
      }
    ]
  }
];
