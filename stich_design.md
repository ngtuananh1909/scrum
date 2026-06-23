<!-- Sprint Outcome - Agile Werewolf -->
<!DOCTYPE html>

<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Sprint Execution - Agile Werewolf</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<style>
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;600;700&family=Geist+Mono:wght@500&display=swap');
    </style>
<script id="tailwind-config">
        tailwind.config = {
          darkMode: "class",
          theme: {
            extend: {
              "colors": {
                      "on-secondary-fixed-variant": "#005321",
                      "on-error-container": "#ffdad6",
                      "primary-fixed-dim": "#c0c1ff",
                      "on-tertiary-fixed": "#410004",
                      "surface-container-low": "#131b2e",
                      "on-primary-fixed-variant": "#2f2ebe",
                      "on-surface-variant": "#c7c4d7",
                      "secondary": "#4ae176",
                      "primary": "#c0c1ff",
                      "surface-container-highest": "#2d3449",
                      "surface": "#0b1326",
                      "background": "#0b1326",
                      "primary-container": "#8083ff",
                      "surface-tint": "#c0c1ff",
                      "tertiary-container": "#ff5451",
                      "surface-dim": "#0b1326",
                      "surface-container": "#171f33",
                      "secondary-fixed-dim": "#4ae176",
                      "on-error": "#690005",
                      "secondary-fixed": "#6bff8f",
                      "inverse-surface": "#dae2fd",
                      "on-secondary": "#003915",
                      "outline": "#908fa0",
                      "on-secondary-container": "#004119",
                      "on-secondary-fixed": "#002109",
                      "surface-container-lowest": "#060e20",
                      "surface-container-high": "#222a3d",
                      "secondary-container": "#00b954",
                      "inverse-primary": "#494bd6",
                      "surface-variant": "#2d3449",
                      "surface-bright": "#31394d",
                      "on-primary": "#1000a9",
                      "inverse-on-surface": "#283044",
                      "on-tertiary": "#68000a",
                      "on-tertiary-container": "#5c0008",
                      "error": "#ffb4ab",
                      "on-tertiary-fixed-variant": "#930013",
                      "on-primary-fixed": "#07006c",
                      "outline-variant": "#464554",
                      "on-surface": "#dae2fd",
                      "tertiary": "#ffb3ad",
                      "tertiary-fixed": "#ffdad7",
                      "on-background": "#dae2fd",
                      "error-container": "#93000a",
                      "tertiary-fixed-dim": "#ffb3ad",
                      "on-primary-container": "#0d0096",
                      "primary-fixed": "#e1e0ff"
              },
              "borderRadius": {
                      "DEFAULT": "0.125rem",
                      "lg": "0.25rem",
                      "xl": "0.5rem",
                      "full": "0.75rem"
              },
              "spacing": {
                      "stack-sm": "0.5rem",
                      "stack-md": "1rem",
                      "container-max": "1200px",
                      "stack-lg": "2rem",
                      "gutter": "1.5rem",
                      "margin": "2rem"
              },
              "fontFamily": {
                      "headline-md": ["Geist"],
                      "label-caps": ["Geist"],
                      "body-lg": ["Geist"],
                      "headline-lg-mobile": ["Geist"],
                      "headline-lg": ["Geist"],
                      "body-md": ["Geist"],
                      "mono-ui": ["Geist Mono"]
              },
              "fontSize": {
                      "headline-md": ["24px", { "lineHeight": "32px", "letterSpacing": "-0.02em", "fontWeight": "600" }],
                      "label-caps": ["12px", { "lineHeight": "16px", "letterSpacing": "0.1em", "fontWeight": "600" }],
                      "body-lg": ["18px", { "lineHeight": "28px", "fontWeight": "400" }],
                      "headline-lg-mobile": ["32px", { "lineHeight": "40px", "letterSpacing": "-0.04em", "fontWeight": "700" }],
                      "headline-lg": ["48px", { "lineHeight": "56px", "letterSpacing": "-0.04em", "fontWeight": "700" }],
                      "body-md": ["16px", { "lineHeight": "24px", "fontWeight": "400" }],
                      "mono-ui": ["14px", { "lineHeight": "20px", "fontWeight": "500" }]
              }
            }
          }
        }
    </script>
<style>
        .glass-panel {
            background: rgba(30, 41, 59, 0.6);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid theme('colors.outline-variant');
        }
        .glow-red {
            box-shadow: inset 0 0 40px rgba(255, 84, 81, 0.1), 0 0 80px rgba(255, 84, 81, 0.2);
            border-color: rgba(255, 84, 81, 0.5);
        }
        .glow-green {
            box-shadow: inset 0 0 40px rgba(74, 225, 118, 0.1), 0 0 80px rgba(74, 225, 118, 0.2);
            border-color: rgba(74, 225, 118, 0.5);
        }
        .bg-alert-glow {
            background: radial-gradient(circle at center, rgba(255, 84, 81, 0.15) 0%, theme('colors.background') 70%);
        }
    </style>
</head>
<body class="bg-background text-on-background font-body-md h-screen overflow-hidden flex flex-col bg-alert-glow">
<!-- TopNavBar -->
<nav class="bg-surface-dim/80 backdrop-blur-xl docked full-width top-0 border-b border-outline-variant flat no shadows flex justify-between items-center w-full px-gutter h-16 z-50">
<div class="flex items-center gap-4">
<span class="font-headline-md text-headline-md font-bold tracking-tighter text-primary">AGILE WEREWOLF</span>
<div class="hidden md:flex gap-6 ml-8">
<span class="text-on-surface-variant font-mono-ui text-mono-ui">Room ID: 8821</span>
<span class="text-secondary font-bold font-mono-ui text-mono-ui">Sprint 3/5</span>
<span class="text-on-surface-variant font-mono-ui text-mono-ui">Rejects: 0/5</span>
</div>
</div>
<div class="flex items-center gap-4 text-on-surface-variant">
<span class="material-symbols-outlined hover:text-primary transition-colors cursor-pointer" style="font-variation-settings: 'FILL' 0;">settings</span>
<span class="material-symbols-outlined hover:text-primary transition-colors cursor-pointer" style="font-variation-settings: 'FILL' 0;">help</span>
</div>
</nav>
<div class="flex flex-1 overflow-hidden relative">
<!-- SideNavBar (Desktop only, contextual logic says it should be hidden or simplified during a focused transactional outcome screen, but JSON includes it, so we render it per strict instructions, but we'll focus the canvas heavily) -->
<aside class="hidden md:flex flex-col h-full overflow-hidden bg-surface-container-low/60 backdrop-blur-lg docked left-0 w-80 border-r border-outline-variant flat no shadows z-40 transition-all duration-200">
<div class="p-6 border-b border-outline-variant">
<div class="flex items-center gap-4 mb-4">
<div class="w-12 h-12 rounded-full bg-surface-variant border border-outline-variant flex items-center justify-center overflow-hidden">
<img class="w-full h-full object-cover" data-alt="A small, stylized avatar portrait of a sci-fi hacker character wearing neon-rimmed glasses in a dark cyberpunk setting. The lighting is moody with subtle blue and green highlights. High tension, sleek, digital aesthetic." src="https://lh3.googleusercontent.com/aida-public/AB6AXuDCsTKvCKsCBqx2-EPMRTBoNIJiDKf1AdkrWyqAH1IJy4IhSU1CnAaoFdQVuCSvrhA_thweyk6-_U86THfBrtPB7dYdYGBWn-3M0hDZwdv4wf4n50Q9IZQmCGY94Ehwr_uYUIRkrGDJXuFsrnKwfc3Am0VqEuatB4yPlTW6MXTHLXh0y2PyunwFUPmOfWPbVM9IDJer1TI6qrG7E3xhKuUiqtLwRz3Z2l1GFS3kiA4ZvlrrN4Ry5z4mexVh5IGCxrWNR4G1Bgn7ocY"/>
</div>
<div>
<div class="font-headline-md text-headline-md text-primary">Project Alpha</div>
<div class="font-label-caps text-label-caps text-error">Phase: Sprint Execution</div>
</div>
</div>
</div>
<nav class="flex-1 py-4">
<a class="flex items-center gap-4 px-6 py-3 text-secondary border-l-2 border-secondary bg-secondary-container/10 transition-all duration-200 font-label-caps text-label-caps hover:bg-surface-container-high" href="#">
<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">dashboard</span>
                    Board
                </a>
<a class="flex items-center gap-4 px-6 py-3 text-on-surface-variant transition-all duration-200 font-label-caps text-label-caps hover:bg-surface-container-high" href="#">
<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 0;">forum</span>
                    Chat
                </a>
<a class="flex items-center gap-4 px-6 py-3 text-on-surface-variant transition-all duration-200 font-label-caps text-label-caps hover:bg-surface-container-high" href="#">
<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 0;">history</span>
                    Logs
                </a>
</nav>
<div class="p-6 mt-auto border-t border-outline-variant">
<a class="flex items-center gap-4 px-4 py-2 text-on-surface-variant transition-all duration-200 font-label-caps text-label-caps hover:bg-surface-container-high" href="#">
<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 0;">account_circle</span>
                    Profile
                </a>
<a class="flex items-center gap-4 px-4 py-2 text-error transition-all duration-200 font-label-caps text-label-caps hover:bg-surface-container-high mt-2" href="#">
<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 0;">logout</span>
                    Leave
                </a>
</div>
</aside>
<!-- Main Content Canvas -->
<main class="flex-1 overflow-y-auto relative p-gutter md:p-margin flex flex-col items-center justify-center z-10">
<!-- Sprint Progress Indicator -->
<div class="absolute top-8 left-1/2 -translate-x-1/2 w-full max-w-lg px-4">
<div class="flex justify-between items-center mb-2">
<span class="font-label-caps text-label-caps text-on-surface-variant">Sprint Progress</span>
</div>
<div class="flex gap-2 w-full h-2">
<div class="flex-1 bg-secondary rounded-full shadow-[0_0_8px_rgba(74,225,118,0.6)]"></div>
<div class="flex-1 bg-secondary rounded-full shadow-[0_0_8px_rgba(74,225,118,0.6)]"></div>
<div class="flex-1 bg-error rounded-full shadow-[0_0_12px_rgba(255,84,81,0.8)] animate-pulse"></div>
<div class="flex-1 bg-surface-variant rounded-full border border-outline-variant"></div>
<div class="flex-1 bg-surface-variant rounded-full border border-outline-variant"></div>
</div>
</div>
<!-- Outcome Header -->
<div class="text-center mb-12 mt-16">
<h1 class="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-error mb-2 tracking-tight uppercase">Sprint Failed</h1>
<p class="font-mono-ui text-mono-ui text-on-surface-variant">Execution phase complete. Analyzing commits...</p>
</div>
<!-- Outcome Cards Container -->
<div class="grid grid-cols-1 md:grid-cols-2 gap-stack-lg w-full max-w-4xl">
<!-- Success Card (Ghosted/Dimmed because it failed) -->
<div class="glass-panel rounded-xl p-8 flex flex-col items-center text-center opacity-40 transition-opacity duration-300">
<div class="w-20 h-20 rounded-full bg-secondary-container/20 border border-secondary/30 flex items-center justify-center mb-6">
<span class="material-symbols-outlined text-4xl text-secondary" style="font-variation-settings: 'FILL' 0;">rocket_launch</span>
</div>
<h2 class="font-headline-md text-headline-md text-on-surface mb-2">Successful Release</h2>
<p class="font-body-md text-body-md text-on-surface-variant mb-6">All tasks completed without critical errors.</p>
<div class="mt-auto font-mono-ui text-mono-ui text-secondary opacity-50">
                        2 Votes
                    </div>
</div>
<!-- Failure Card (Active/Glowing) -->
<div class="glass-panel rounded-xl p-8 flex flex-col items-center text-center glow-red relative overflow-hidden transform scale-105 z-10 transition-transform duration-300">
<div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjIiIGZpbGw9IiNGRjU0NTEiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')] opacity-50"></div>
<div class="w-24 h-24 rounded-full bg-error-container/40 border-2 border-error flex items-center justify-center mb-6 relative z-10 animate-[pulse_2s_infinite]">
<span class="material-symbols-outlined text-5xl text-tertiary-container" style="font-variation-settings: 'FILL' 1;">bug_report</span>
</div>
<h2 class="font-headline-md text-headline-md text-error mb-2 relative z-10 font-bold uppercase">Critical Bug</h2>
<p class="font-body-md text-body-md text-on-error-container mb-6 relative z-10">Sabotage detected in the deployment pipeline.</p>
<div class="mt-auto w-full border-t border-error/30 pt-4 relative z-10">
<div class="flex items-center justify-center gap-2 font-mono-ui text-mono-ui text-error font-bold">
<span class="material-symbols-outlined text-error text-sm" style="font-variation-settings: 'FILL' 1;">warning</span>
                            1 Sabotage detected
                        </div>
</div>
</div>
</div>
<!-- Action Area -->
<div class="mt-16 text-center z-10 w-full max-w-sm">
<p class="font-mono-ui text-mono-ui text-on-surface-variant mb-4">Awaiting Project Manager decision...</p>
<button class="w-full bg-surface-container-high border border-outline-variant text-on-surface py-4 rounded-lg font-label-caps text-label-caps hover:bg-surface-variant transition-colors cursor-not-allowed opacity-50 flex items-center justify-center gap-2">
<span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 0;">hourglass_empty</span>
                    Next Phase
                </button>
</div>
</main>
</div>
</body></html>

<!-- Project Lobby - Agile Werewolf -->
<!DOCTYPE html>

<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Game Lobby - AGILE WEREWOLF</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;600;700&amp;family=Geist+Mono:wght@500&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    "colors": {
                        "on-secondary-fixed-variant": "#005321",
                        "on-error-container": "#ffdad6",
                        "primary-fixed-dim": "#c0c1ff",
                        "on-tertiary-fixed": "#410004",
                        "surface-container-low": "#131b2e",
                        "on-primary-fixed-variant": "#2f2ebe",
                        "on-surface-variant": "#c7c4d7",
                        "secondary": "#4ae176",
                        "primary": "#c0c1ff",
                        "surface-container-highest": "#2d3449",
                        "surface": "#0b1326",
                        "background": "#0b1326",
                        "primary-container": "#8083ff",
                        "surface-tint": "#c0c1ff",
                        "tertiary-container": "#ff5451",
                        "surface-dim": "#0b1326",
                        "surface-container": "#171f33",
                        "secondary-fixed-dim": "#4ae176",
                        "on-error": "#690005",
                        "secondary-fixed": "#6bff8f",
                        "inverse-surface": "#dae2fd",
                        "on-secondary": "#003915",
                        "outline": "#908fa0",
                        "on-secondary-container": "#004119",
                        "on-secondary-fixed": "#002109",
                        "surface-container-lowest": "#060e20",
                        "surface-container-high": "#222a3d",
                        "secondary-container": "#00b954",
                        "inverse-primary": "#494bd6",
                        "surface-variant": "#2d3449",
                        "surface-bright": "#31394d",
                        "on-primary": "#1000a9",
                        "inverse-on-surface": "#283044",
                        "on-tertiary": "#68000a",
                        "on-tertiary-container": "#5c0008",
                        "error": "#ffb4ab",
                        "on-tertiary-fixed-variant": "#930013",
                        "on-primary-fixed": "#07006c",
                        "outline-variant": "#464554",
                        "on-surface": "#dae2fd",
                        "tertiary": "#ffb3ad",
                        "tertiary-fixed": "#ffdad7",
                        "on-background": "#dae2fd",
                        "error-container": "#93000a",
                        "tertiary-fixed-dim": "#ffb3ad",
                        "on-primary-container": "#0d0096",
                        "primary-fixed": "#e1e0ff"
                    },
                    "borderRadius": {
                        "DEFAULT": "0.125rem",
                        "lg": "0.25rem",
                        "xl": "0.5rem",
                        "full": "0.75rem"
                    },
                    "spacing": {
                        "stack-sm": "0.5rem",
                        "stack-md": "1rem",
                        "container-max": "1200px",
                        "stack-lg": "2rem",
                        "gutter": "1.5rem",
                        "margin": "2rem"
                    },
                    "fontFamily": {
                        "headline-md": ["Geist"],
                        "label-caps": ["Geist"],
                        "body-lg": ["Geist"],
                        "headline-lg-mobile": ["Geist"],
                        "headline-lg": ["Geist"],
                        "body-md": ["Geist"],
                        "mono-ui": ["Geist Mono"]
                    },
                    "fontSize": {
                        "headline-md": ["24px", { "lineHeight": "32px", "letterSpacing": "-0.02em", "fontWeight": "600" }],
                        "label-caps": ["12px", { "lineHeight": "16px", "letterSpacing": "0.1em", "fontWeight": "600" }],
                        "body-lg": ["18px", { "lineHeight": "28px", "fontWeight": "400" }],
                        "headline-lg-mobile": ["32px", { "lineHeight": "40px", "letterSpacing": "-0.04em", "fontWeight": "700" }],
                        "headline-lg": ["48px", { "lineHeight": "56px", "letterSpacing": "-0.04em", "fontWeight": "700" }],
                        "body-md": ["16px", { "lineHeight": "24px", "fontWeight": "400" }],
                        "mono-ui": ["14px", { "lineHeight": "20px", "fontWeight": "500" }]
                    }
                }
            }
        }
    </script>
<style>
        body { background-color: #0F172A; }
        .glass-panel {
            background-color: rgba(30, 41, 59, 0.6);
            backdrop-filter: blur(12px);
            border: 1px solid theme('colors.outline-variant');
        }
        .glass-panel-alert {
            background-color: rgba(30, 41, 59, 0.6);
            backdrop-filter: blur(12px);
            border: 1px solid theme('colors.error');
        }
        .status-strip-villager { border-left: 4px solid theme('colors.secondary'); }
        .status-strip-werewolf { border-left: 4px solid theme('colors.error'); }
        .status-strip-system { border-left: 4px solid theme('colors.primary'); }
        
        /* Subtle scanline effect for atmosphere */
        .scanlines::before {
            content: " ";
            display: block;
            position: absolute;
            top: 0;
            left: 0;
            bottom: 0;
            right: 0;
            background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
            z-index: 50;
            background-size: 100% 2px, 3px 100%;
            pointer-events: none;
            opacity: 0.3;
        }
    </style>
</head>
<body class="text-on-background min-h-screen flex flex-col font-body-md overflow-x-hidden scanlines">
<!-- TopNavBar -->
<header class="bg-surface-dim/80 backdrop-blur-xl border-b border-outline-variant flex justify-between items-center w-full px-gutter h-16 sticky top-0 z-40">
<div class="flex items-center gap-4">
<span class="font-headline-md text-headline-md font-bold tracking-tighter text-primary">AGILE WEREWOLF</span>
</div>
<nav class="hidden md:flex gap-6 items-center">
<span class="text-secondary font-bold font-mono-ui text-mono-ui">Room ID: 8821</span>
<span class="text-on-surface-variant font-mono-ui text-mono-ui">Sprint 3/5</span>
<span class="text-on-surface-variant font-mono-ui text-mono-ui">Rejects: 0/5</span>
</nav>
<div class="flex items-center gap-2">
<button class="p-2 hover:bg-surface-container-highest transition-colors rounded-full text-on-surface-variant active:scale-95 duration-150">
<span class="material-symbols-outlined">settings</span>
</button>
<button class="p-2 hover:bg-surface-container-highest transition-colors rounded-full text-on-surface-variant active:scale-95 duration-150">
<span class="material-symbols-outlined">help</span>
</button>
</div>
</header>
<div class="flex-1 flex overflow-hidden">
<!-- Main Content Area -->
<main class="flex-1 overflow-y-auto p-gutter relative">
<div class="max-w-container-max mx-auto space-y-stack-lg">
<!-- Phase Indicator / Action Area -->
<div class="glass-panel rounded-xl p-gutter flex flex-col md:flex-row justify-between items-center gap-4">
<div>
<h1 class="font-headline-lg text-headline-lg text-primary tracking-tighter mb-2">LOBBY : BACKLOG</h1>
<p class="text-on-surface-variant font-mono-ui text-mono-ui flex items-center gap-2">
<span class="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
                            Waiting for players... (7/10)
                        </p>
</div>
<button class="bg-primary-container text-on-primary-container hover:bg-inverse-primary hover:text-white px-8 py-4 rounded-lg font-label-caps text-label-caps transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.6)] border border-primary/50">
                        START SPRINT 1
                    </button>
</div>
<!-- Player Grid -->
<div>
<h2 class="font-headline-md text-headline-md text-on-surface mb-stack-md border-b border-outline-variant pb-2 inline-block">Dev Team (Players)</h2>
<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-stack-md">
<!-- Filled Player Card (Host) -->
<div class="glass-panel rounded-lg p-stack-md status-strip-system relative overflow-hidden group">
<div class="absolute top-2 right-2 flex gap-1">
<span class="material-symbols-outlined text-primary text-[16px]" style="font-variation-settings: 'FILL' 1;">star</span>
</div>
<div class="flex flex-col items-center gap-3">
<img class="w-16 h-16 rounded-full border-2 border-primary object-cover bg-surface-container" data-alt="A futuristic avatar of a network administrator, sharp neon blue lighting, dark background, highly detailed techwear, cyberpunk aesthetic, professional portrait orientation." src="https://lh3.googleusercontent.com/aida-public/AB6AXuDByaU4MONZmw1T2fYDockpLH8mrWwYnf-aHWteinwmE8pkyxUBfbVIocaZZhlL3Tp3tAFvFUPii6vRd1JBhpKmTUOg5pBrlACxuXxABi17ohNZ8Bw2fdaKqPy27tYrWDwkHQZDnvzaWvkHEDkLTr_M2qTZ7wkkd_04E1nTwoePBDW6asfMkzn2PXBp4nZYWHL6Km0yJkSbn9ZY5sj_TwvPKtFd6IWViryfpqfUPNu60sV4UW-h6DljwCMzsPNvKa-95yEVMmBcP_Y"/>
<div class="text-center">
<div class="font-body-md text-body-md text-on-surface font-semibold">ScrumMaster99</div>
<div class="font-mono-ui text-[10px] text-primary">HOST</div>
</div>
</div>
</div>
<!-- Filled Player Card -->
<div class="glass-panel rounded-lg p-stack-md status-strip-villager relative">
<div class="flex flex-col items-center gap-3">
<img class="w-16 h-16 rounded-full border border-secondary object-cover bg-surface-container" data-alt="A portrait of a tired software developer lit by the harsh glow of multiple monitors, deep shadows, subtle green matrix-like reflections in glasses, serious expression, modern corporate thriller aesthetic." src="https://lh3.googleusercontent.com/aida-public/AB6AXuAR7YkVqF-aABas7wyw02rCcj10nUeUHX3jnbNvdKld3-IlZwbmdfNHmDsvH9QHrLA6UmFjnTqBH7aXc4SClPFhW3mZYYzVIHk_DLANINsufGqkd2jbvXhps4hXWmVWJ_WmkV9DEBhqlgrUYJkBJ7KKC89GvBmf0RmqE7NC1QyO5s9l5SbB26PO0Xie_SgV9Alv7wWQe8tdOGFtHxPBF05sEXhmt0qJMliqDgeSOLxctm_aF13W6BM6SlIzOQBiz5E5BvIcD0QZPV0"/>
<div class="text-center">
<div class="font-body-md text-body-md text-on-surface">CodeNinja</div>
<div class="font-mono-ui text-[10px] text-secondary">READY</div>
</div>
</div>
</div>
<!-- Filled Player Card -->
<div class="glass-panel rounded-lg p-stack-md status-strip-villager relative">
<div class="flex flex-col items-center gap-3">
<img class="w-16 h-16 rounded-full border border-secondary object-cover bg-surface-container" data-alt="Abstract geometric avatar icon, minimalist glowing emerald shapes forming a face on a completely black background, sharp vector style but rendered with cinematic lighting." src="https://lh3.googleusercontent.com/aida-public/AB6AXuCyEiyft8jiSy2IsWeQVyRdYx5drOK7MGyCrGX50UJOQ815vbcUsNEX8bpL4nDQZ--ovChuq26CMHeMAQ-jXxPNcTA6s-2Llxq7FoXAtzVqTrv238AHZeOiYBr_aoYseJ184Ah607Kex8vuRNtrFHo6px8NeYuhLRnTlVwQxkTpUzA_7AdCG0oxWkR3Dc2W9TXM1NaQ9-6iUFykl1PuP_L-x4WkXzp3xWZ8FglglrZ4q2RqxEXufqwjn2f7UNElts5-rQIFnVhVV0Y"/>
<div class="text-center">
<div class="font-body-md text-body-md text-on-surface">QA_Lead</div>
<div class="font-mono-ui text-[10px] text-secondary">READY</div>
</div>
</div>
</div>
<!-- Filled Player Card -->
<div class="glass-panel rounded-lg p-stack-md status-strip-villager relative">
<div class="flex flex-col items-center gap-3">
<img class="w-16 h-16 rounded-full border border-secondary object-cover bg-surface-container" data-alt="A gritty cyberpunk portrait of an investigator, neon rim lighting in magenta and teal, shadows obscuring half the face, intense stare, rain-streaked glass texture overlay." src="https://lh3.googleusercontent.com/aida-public/AB6AXuDA33R3kaR3brn6RQJe3-hyGLiGN3s5UK0PBg2xYG8xqK7FeZDJAsXxAs7XzdPSd70Mowh_EIJzHsZTXtpE32t26zGAQ7UrIGX1YFDQQX-KBW2bPxcpwKGVBX783YPFCc-4AbMbnwt0IiJSd3NVksKSOhA-_Zil27HPFecKrypG6uNanUIR_uLOSVBsz8mjKafoofIRb6nWjwQAJ47HtE5zc6ruQ7Y7VFQX6RV4apabaWqf0tGLGK1tjNfYwrl2NpXFAzKYoA6800U"/>
<div class="text-center">
<div class="font-body-md text-body-md text-on-surface">BugHunter</div>
<div class="font-mono-ui text-[10px] text-secondary">READY</div>
</div>
</div>
</div>
<!-- Filled Player Card -->
<div class="glass-panel rounded-lg p-stack-md status-strip-villager relative">
<div class="flex flex-col items-center gap-3">
<img class="w-16 h-16 rounded-full border border-secondary object-cover bg-surface-container" data-alt="A sleek corporate operative in a high-tech boardroom, stark cool white lighting, dark navy suit, subtle glowing earpiece, hyper-realistic, tense atmosphere." src="https://lh3.googleusercontent.com/aida-public/AB6AXuB6IrnQP24uagcM4VCxSMEDMmKZBwIZwloIAQn98M3P8wtGKqT6iUVIXmdObXmkI7VC9KdfM3UJIV7CZxO9Qvsbp1X48YEsXUiFWRGkTGkrBAy80tnvyBJfifWgpobZw5kaQGqAFnpQxHjjtaBptc8Zictg1CSBScCHcLX1XRsonVWbEoAAkMoEHkGZaXjYk5iCgg5UZj8FoT_AVRWJ5cS5nqtcZOfyiQ7leB6LigNuuF7ZVKHg-LJdDdcjjvKICikqIAOqj5uEnIk"/>
<div class="text-center">
<div class="font-body-md text-body-md text-on-surface">ProductOwner</div>
<div class="font-mono-ui text-[10px] text-secondary">READY</div>
</div>
</div>
</div>
<!-- Empty Player Slots -->
<div class="glass-panel rounded-lg p-stack-md border-dashed border-outline-variant flex flex-col items-center justify-center min-h-[140px] opacity-50">
<span class="material-symbols-outlined text-outline-variant text-4xl mb-2">person_add</span>
<div class="font-mono-ui text-mono-ui text-outline-variant">Waiting...</div>
</div>
<div class="glass-panel rounded-lg p-stack-md border-dashed border-outline-variant flex flex-col items-center justify-center min-h-[140px] opacity-50">
<span class="material-symbols-outlined text-outline-variant text-4xl mb-2">person_add</span>
<div class="font-mono-ui text-mono-ui text-outline-variant">Waiting...</div>
</div>
<div class="glass-panel rounded-lg p-stack-md border-dashed border-outline-variant flex flex-col items-center justify-center min-h-[140px] opacity-50">
<span class="material-symbols-outlined text-outline-variant text-4xl mb-2">person_add</span>
<div class="font-mono-ui text-mono-ui text-outline-variant">Waiting...</div>
</div>
<div class="glass-panel rounded-lg p-stack-md border-dashed border-outline-variant flex flex-col items-center justify-center min-h-[140px] opacity-50">
<span class="material-symbols-outlined text-outline-variant text-4xl mb-2">person_add</span>
<div class="font-mono-ui text-mono-ui text-outline-variant">Waiting...</div>
</div>
<div class="glass-panel rounded-lg p-stack-md border-dashed border-outline-variant flex flex-col items-center justify-center min-h-[140px] opacity-50">
<span class="material-symbols-outlined text-outline-variant text-4xl mb-2">person_add</span>
<div class="font-mono-ui text-mono-ui text-outline-variant">Waiting...</div>
</div>
</div>
</div>
</div>
</main>
<!-- SideNavBar (Chat/Logs) -->
<aside class="hidden lg:flex flex-col bg-surface-container-low/60 backdrop-blur-lg border-l border-outline-variant h-full w-80 docked right-0 transition-all duration-200">
<!-- Tabs -->
<div class="flex border-b border-outline-variant">
<button class="flex-1 py-3 text-center text-secondary border-b-2 border-secondary bg-secondary-container/10 font-label-caps text-label-caps transition-colors">
<span class="material-symbols-outlined text-[18px] align-middle mr-1">forum</span> CHAT
                </button>
<button class="flex-1 py-3 text-center text-on-surface-variant hover:bg-surface-container-high font-label-caps text-label-caps transition-colors">
<span class="material-symbols-outlined text-[18px] align-middle mr-1">history</span> LOGS
                </button>
</div>
<!-- Chat Area -->
<div class="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col font-mono-ui text-mono-ui">
<div class="text-outline text-center text-[12px] my-2">-- Room Created: 14:02:45 UTC --</div>
<div class="flex flex-col gap-1">
<span class="text-[12px] text-primary">System</span>
<span class="text-on-surface bg-surface-container p-2 rounded-r-lg rounded-bl-lg border-l 2px solid theme('colors.primary')">Welcome to Agile Werewolf Lobby. Waiting for 10 players.</span>
</div>
<div class="flex flex-col gap-1">
<span class="text-[12px] text-on-surface-variant">CodeNinja</span>
<span class="text-on-surface bg-surface-container-high p-2 rounded-r-lg rounded-bl-lg">Hey team, backend is ready.</span>
</div>
<div class="flex flex-col gap-1">
<span class="text-[12px] text-on-surface-variant">QA_Lead</span>
<span class="text-on-surface bg-surface-container-high p-2 rounded-r-lg rounded-bl-lg">I've got my eye on all of you...</span>
</div>
<div class="flex flex-col gap-1">
<span class="text-[12px] text-on-surface-variant">ScrumMaster99</span>
<span class="text-on-surface bg-surface-container-high p-2 rounded-r-lg rounded-bl-lg">Just waiting on a few more tickets to move to To-Do before we start.</span>
</div>
</div>
<!-- Chat Input -->
<div class="p-4 border-t border-outline-variant bg-surface-dim">
<div class="relative">
<input class="w-full bg-surface-container border border-outline-variant rounded-md py-2 px-3 text-on-surface font-mono-ui text-mono-ui focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-outline" placeholder="Type a message..." type="text"/>
<button class="absolute right-2 top-1/2 -translate-y-1/2 text-primary hover:text-primary-container">
<span class="material-symbols-outlined">send</span>
</button>
</div>
</div>
</aside>
</div>
</body></html>

<!-- Sprint Planning - Agile Werewolf -->
<!DOCTYPE html>

<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Sprint Planning - Agile Werewolf</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com" rel="preconnect"/>
<link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect"/>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;600;700&amp;family=Geist+Mono:wght@500&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
        tailwind.config = {
          darkMode: "class",
          theme: {
            extend: {
              "colors": {
                      "on-secondary-fixed-variant": "#005321",
                      "on-error-container": "#ffdad6",
                      "primary-fixed-dim": "#c0c1ff",
                      "on-tertiary-fixed": "#410004",
                      "surface-container-low": "#131b2e",
                      "on-primary-fixed-variant": "#2f2ebe",
                      "on-surface-variant": "#c7c4d7",
                      "secondary": "#4ae176",
                      "primary": "#c0c1ff",
                      "surface-container-highest": "#2d3449",
                      "surface": "#0b1326",
                      "background": "#0b1326",
                      "primary-container": "#8083ff",
                      "surface-tint": "#c0c1ff",
                      "tertiary-container": "#ff5451",
                      "surface-dim": "#0b1326",
                      "surface-container": "#171f33",
                      "secondary-fixed-dim": "#4ae176",
                      "on-error": "#690005",
                      "secondary-fixed": "#6bff8f",
                      "inverse-surface": "#dae2fd",
                      "on-secondary": "#003915",
                      "outline": "#908fa0",
                      "on-secondary-container": "#004119",
                      "on-secondary-fixed": "#002109",
                      "surface-container-lowest": "#060e20",
                      "surface-container-high": "#222a3d",
                      "secondary-container": "#00b954",
                      "inverse-primary": "#494bd6",
                      "surface-variant": "#2d3449",
                      "surface-bright": "#31394d",
                      "on-primary": "#1000a9",
                      "inverse-on-surface": "#283044",
                      "on-tertiary": "#68000a",
                      "on-tertiary-container": "#5c0008",
                      "error": "#ffb4ab",
                      "on-tertiary-fixed-variant": "#930013",
                      "on-primary-fixed": "#07006c",
                      "outline-variant": "#464554",
                      "on-surface": "#dae2fd",
                      "tertiary": "#ffb3ad",
                      "tertiary-fixed": "#ffdad7",
                      "on-background": "#dae2fd",
                      "error-container": "#93000a",
                      "tertiary-fixed-dim": "#ffb3ad",
                      "on-primary-container": "#0d0096",
                      "primary-fixed": "#e1e0ff"
              },
              "borderRadius": {
                      "DEFAULT": "0.125rem",
                      "lg": "0.25rem",
                      "xl": "0.5rem",
                      "full": "0.75rem"
              },
              "spacing": {
                      "stack-sm": "0.5rem",
                      "stack-md": "1rem",
                      "container-max": "1200px",
                      "stack-lg": "2rem",
                      "gutter": "1.5rem",
                      "margin": "2rem"
              },
              "fontFamily": {
                      "headline-md": [
                              "Geist"
                      ],
                      "label-caps": [
                              "Geist"
                      ],
                      "body-lg": [
                              "Geist"
                      ],
                      "headline-lg-mobile": [
                              "Geist"
                      ],
                      "headline-lg": [
                              "Geist"
                      ],
                      "body-md": [
                              "Geist"
                      ],
                      "mono-ui": [
                              "Geist Mono"
                      ]
              },
              "fontSize": {
                      "headline-md": [
                              "24px",
                              {
                                      "lineHeight": "32px",
                                      "letterSpacing": "-0.02em",
                                      "fontWeight": "600"
                              }
                      ],
                      "label-caps": [
                              "12px",
                              {
                                      "lineHeight": "16px",
                                      "letterSpacing": "0.1em",
                                      "fontWeight": "600"
                              }
                      ],
                      "body-lg": [
                              "18px",
                              {
                                      "lineHeight": "28px",
                                      "fontWeight": "400"
                              }
                      ],
                      "headline-lg-mobile": [
                              "32px",
                              {
                                      "lineHeight": "40px",
                                      "letterSpacing": "-0.04em",
                                      "fontWeight": "700"
                              }
                      ],
                      "headline-lg": [
                              "48px",
                              {
                                      "lineHeight": "56px",
                                      "letterSpacing": "-0.04em",
                                      "fontWeight": "700"
                              }
                      ],
                      "body-md": [
                              "16px",
                              {
                                      "lineHeight": "24px",
                                      "fontWeight": "400"
                              }
                      ],
                      "mono-ui": [
                              "14px",
                              {
                                      "lineHeight": "20px",
                                      "fontWeight": "500"
                              }
                      ]
              }
      },
          },
        }
      </script>
<style>
        body {
            background-color: #0F172A; /* Base Level 1 */
            background-image: 
                radial-gradient(circle at 15% 50%, rgba(99, 102, 241, 0.05), transparent 25%),
                radial-gradient(circle at 85% 30%, rgba(74, 225, 118, 0.03), transparent 25%);
        }
        
        .glass-panel {
            background-color: rgba(30, 41, 59, 0.6); /* Level 2 fill */
            backdrop-filter: blur(12px);
            border: 1px solid #1e293b; /* Slate-800 equivalent neutral border */
        }

        .glass-modal {
            background-color: rgba(30, 41, 59, 0.8);
            backdrop-filter: blur(20px);
            box-shadow: inset 0 0 0 1px rgba(99, 102, 241, 0.2); /* Indigo inner glow */
        }

        .status-strip-neutral { border-left: 4px solid #94a3b8; } /* Slate-400 */
        .status-strip-po { border-left: 4px solid #6366f1; } /* Primary/Indigo */
        .status-strip-nominated { border-left: 4px solid #4ae176; } /* Secondary/Green */

        /* Custom scrollbar for chat/logs */
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #475569; }
      </style>
</head>
<body class="text-on-surface h-screen w-screen overflow-hidden flex flex-col font-body-md">
<!-- TopNavBar Component -->
<header class="bg-surface-dim/80 backdrop-blur-xl docked full-width top-0 border-b border-outline-variant flat no shadows flex justify-between items-center w-full px-gutter h-16 z-50 shrink-0">
<div class="flex items-center gap-4">
<span class="font-headline-md text-headline-md font-bold tracking-tighter text-primary">AGILE WEREWOLF</span>
<nav class="hidden md:flex items-center gap-6 ml-8">
<span class="text-on-surface-variant text-body-md font-body-md">Room ID: 8821</span>
<span class="text-secondary font-bold text-body-md font-body-md">Sprint 1/5</span>
<span class="text-on-surface-variant text-body-md font-body-md">Rejects: 0/4</span>
</nav>
</div>
<div class="flex items-center gap-4">
<button class="text-on-surface-variant hover:text-on-surface transition-colors p-2 rounded-full hover:bg-surface-container-highest active:scale-95 duration-150 flex items-center justify-center">
<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 0;">settings</span>
</button>
<button class="text-on-surface-variant hover:text-on-surface transition-colors p-2 rounded-full hover:bg-surface-container-highest active:scale-95 duration-150 flex items-center justify-center">
<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 0;">help</span>
</button>
</div>
</header>
<div class="flex flex-1 overflow-hidden relative">
<!-- Phase Indicator Banner -->
<div class="absolute top-0 left-0 w-full flex justify-center pt-stack-lg z-10 pointer-events-none">
<div class="glass-modal px-8 py-4 rounded-xl flex flex-col items-center">
<span class="font-label-caps text-label-caps text-primary tracking-widest uppercase mb-1">Current Phase</span>
<h1 class="font-headline-lg text-headline-lg text-on-surface font-bold">Sprint Planning</h1>
</div>
</div>
<!-- Main Content Area (Board) -->
<main class="flex-1 h-full overflow-y-auto p-gutter pt-32 pb-32">
<div class="max-w-4xl mx-auto flex flex-col gap-stack-lg">
<!-- Product Owner Context -->
<div class="glass-panel p-6 rounded-xl flex items-center justify-between border-l-4 border-l-primary-container">
<div>
<h2 class="font-headline-md text-headline-md text-on-surface mb-2">You are the Product Owner</h2>
<p class="font-body-md text-body-md text-on-surface-variant">Nominate 3 developers for the upcoming sprint. The team must approve your plan.</p>
</div>
<div class="flex flex-col items-end">
<span class="font-mono-ui text-mono-ui text-on-surface-variant">Required Devs</span>
<span class="font-headline-md text-headline-md text-secondary">0 / 3</span>
</div>
</div>
<!-- Team Nomination Grid -->
<div>
<h3 class="font-label-caps text-label-caps text-on-surface-variant mb-stack-md ml-2">Available Roster</h3>
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-stack-md">
<!-- Player Card (Self/PO) -->
<button class="glass-panel rounded-lg p-4 flex items-start gap-4 status-strip-po hover:bg-surface-container-high transition-colors text-left group">
<div class="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center overflow-hidden shrink-0 border border-outline-variant">
<img class="w-full h-full object-cover" data-alt="A futuristic avatar of a tech professional in a cyberpunk command center, dark atmospheric lighting with neon indigo accents, hyper-realistic, digital art style, high contrast." src="https://lh3.googleusercontent.com/aida-public/AB6AXuD7lvvS6sKGVyi8ZiEIEHUltSh4DpHW4eS3RKbPbnspMWI2NHuRSD8b134nGx_maBeSE0IKnRb51QcJ7qvaJeyl6PfqtVg2SSLZP9YL755y7Oj3tu3tOSMaygjzGBf0kWPaTl3TgKItmJAMUJtTmOzvLqouyHQdbrmxoUcltEYAs9hNuZ0OugXQKVqCQUBnSIpVTB62MX_j5N921DbiaB1gfTx3zWWOFDhTcy99nidRk6NlROX2Bmxs4tLgb0_22FqrtcdDB6jqSAw"/>
</div>
<div class="flex-1">
<div class="flex justify-between items-center mb-1">
<span class="font-body-md text-body-md font-bold text-on-surface group-hover:text-primary transition-colors">You (PO)</span>
</div>
<span class="font-label-caps text-label-caps text-on-surface-variant">Sr. Engineer</span>
</div>
<div class="shrink-0 w-6 h-6 rounded-full border border-outline flex items-center justify-center group-hover:border-primary transition-colors">
<!-- empty checkbox state -->
</div>
</button>
<!-- Player Card (Nominated) -->
<button class="glass-panel rounded-lg p-4 flex items-start gap-4 status-strip-nominated hover:bg-surface-container-high transition-colors text-left group border-secondary/50">
<div class="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center overflow-hidden shrink-0 border border-outline-variant">
<img class="w-full h-full object-cover" data-alt="A futuristic avatar of a developer in a dimly lit server room, glowing green data streams reflecting on glasses, hyper-realistic, cyber-noir style, moody lighting." src="https://lh3.googleusercontent.com/aida-public/AB6AXuCJleUhdYrd4qEjlHopWh7krH9j6KvnlpUesUL1msbaBUmIwDBwqSkRXsBwSd71Q0Vwn5O8aYW5SdUF1S2JwzgsIg55ET9y5dbZp-phXSbjD-c7DfF9-1kkobrnyUdedzPpVI9g-K9rx422gtINntdzR1KZsHDJDCOlgCt85kmaJdzKGJGCUGC4iKTVc6bnkR6aVKCBCVm27ZL80VhLYagDei2-_CI4jIgtobyYwuGXPheDaXKagwvrFr3QsgUIGsIyyRMYAzspGec"/>
</div>
<div class="flex-1">
<div class="flex justify-between items-center mb-1">
<span class="font-body-md text-body-md font-bold text-on-surface">Alex_Dev</span>
</div>
<span class="font-label-caps text-label-caps text-on-surface-variant">Frontend</span>
</div>
<div class="shrink-0 w-6 h-6 rounded-full bg-secondary text-on-secondary flex items-center justify-center">
<span class="material-symbols-outlined text-[16px]">check</span>
</div>
</button>
<!-- Player Card (Neutral) -->
<button class="glass-panel rounded-lg p-4 flex items-start gap-4 status-strip-neutral hover:bg-surface-container-high transition-colors text-left group">
<div class="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center overflow-hidden shrink-0 border border-outline-variant">
<img class="w-full h-full object-cover" data-alt="A portrait of a mysterious UI designer in a sleek, minimalist dark workspace, subtle blue monitor glow, cinematic lighting, sharp focus, professional tech environment." src="https://lh3.googleusercontent.com/aida-public/AB6AXuCu1i60DmbF5WrnJYqSx5KLCckVKilRm95fUJ0C_vhS5Yr87j7pmJlILDDiY5sxkQBge-qAKCoQhmy21IaWCpANn1Fi-8umIaTGIDujAXNphdhgf6L-5pEdSOPbHHrfgeA82pso-OIIybNx45zs5akNqCelGOwU4aqj0q6uQSkwestj5A3etYYCQiWYyxzjm0x2T1f0XFfMAZeZjRhSILx8QAdjOxBJWEXktR5rREPDibDZqfLt2QOJdqW22R6UZkPDcz_mVaqG5OE"/>
</div>
<div class="flex-1">
<div class="flex justify-between items-center mb-1">
<span class="font-body-md text-body-md font-bold text-on-surface group-hover:text-primary transition-colors">Sam_UX</span>
</div>
<span class="font-label-caps text-label-caps text-on-surface-variant">Designer</span>
</div>
<div class="shrink-0 w-6 h-6 rounded-full border border-outline flex items-center justify-center group-hover:border-primary transition-colors">
</div>
</button>
<!-- Player Card (Neutral) -->
<button class="glass-panel rounded-lg p-4 flex items-start gap-4 status-strip-neutral hover:bg-surface-container-high transition-colors text-left group">
<div class="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center overflow-hidden shrink-0 border border-outline-variant">
<img class="w-full h-full object-cover" data-alt="A portrait of a backend architect in a high-tech control room, monitors displaying complex code structures in the background, sharp shadows, cool blue and green tones, highly detailed." src="https://lh3.googleusercontent.com/aida-public/AB6AXuBR0s7wcnERb-_q88oMYBfHv8CSVUqpk6JjvMeXpCQ54Z0UnuHjPOsWirzlRY_EDWEb_Qgk9m3212rRomjoTcBBjebPK1VhlzYZydEAT4C4hIyxyxR5_-u4Nyx_adOQTNKTYpHXM7ZlL5X6Z7zS4LZQfEf7uLf9NpkF5QperJGxoB948MuBH_zjBcbZqbbrg9GFkt2ZwYRJiCdhslVQu6lK5ql0dTZPVe58gDCRGOs6RBO5Q56lH7gzLnpTBPjUL-l-ATOEoz3lZxU"/>
</div>
<div class="flex-1">
<div class="flex justify-between items-center mb-1">
<span class="font-body-md text-body-md font-bold text-on-surface group-hover:text-primary transition-colors">Taylor_Ops</span>
</div>
<span class="font-label-caps text-label-caps text-on-surface-variant">DevOps</span>
</div>
<div class="shrink-0 w-6 h-6 rounded-full border border-outline flex items-center justify-center group-hover:border-primary transition-colors">
</div>
</button>
</div>
</div>
</div>
</main>
<!-- SideNavBar Component (Logs/Chat) -->
<aside class="hidden md:flex flex-col h-full overflow-hidden bg-surface-container-low/60 backdrop-blur-lg docked right-0 w-80 border-l border-outline-variant flat no shadows transition-all duration-200 shrink-0">
<!-- SideNav Tabs -->
<div class="flex border-b border-outline-variant">
<button class="flex-1 py-3 px-2 flex flex-col items-center gap-1 text-on-surface-variant hover:bg-surface-container-high transition-colors">
<span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' 0;">dashboard</span>
<span class="font-label-caps text-[10px]">Board</span>
</button>
<button class="flex-1 py-3 px-2 flex flex-col items-center gap-1 text-secondary border-b-2 border-secondary bg-secondary-container/10 transition-colors">
<span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' 1;">forum</span>
<span class="font-label-caps text-[10px]">Chat</span>
</button>
<button class="flex-1 py-3 px-2 flex flex-col items-center gap-1 text-on-surface-variant hover:bg-surface-container-high transition-colors">
<span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' 0;">history</span>
<span class="font-label-caps text-[10px]">Logs</span>
</button>
</div>
<!-- Chat Content -->
<div class="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
<!-- System Message -->
<div class="flex flex-col gap-1">
<div class="flex items-center gap-2">
<span class="w-2 h-2 rounded-full bg-primary-container"></span>
<span class="font-mono-ui text-[12px] text-on-surface-variant">SYSTEM • 10:42</span>
</div>
<p class="font-mono-ui text-mono-ui text-on-surface bg-surface-container-highest p-2 rounded border border-outline-variant/50">Sprint Planning phase initiated. Product Owner must nominate 3 developers.</p>
</div>
<!-- User Message -->
<div class="flex flex-col gap-1">
<div class="flex items-center gap-2">
<span class="font-mono-ui text-[12px] text-on-surface-variant">Alex_Dev • 10:43</span>
</div>
<p class="font-body-md text-body-md text-on-surface bg-surface-container p-2 rounded-r-lg rounded-bl-lg">I've got capacity this sprint, put me in.</p>
</div>
<!-- User Message (Self) -->
<div class="flex flex-col gap-1 items-end">
<div class="flex items-center gap-2">
<span class="font-mono-ui text-[12px] text-primary">You • 10:44</span>
</div>
<p class="font-body-md text-body-md text-on-primary-container bg-primary-container p-2 rounded-l-lg rounded-br-lg">Adding you now.</p>
</div>
</div>
<!-- Chat Input -->
<div class="p-4 border-t border-outline-variant bg-surface-container-lowest">
<div class="relative">
<input class="w-full bg-surface-container border border-outline-variant rounded-lg py-2 pl-3 pr-10 text-on-surface font-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none placeholder:text-outline" placeholder="Send message..." type="text"/>
<button class="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors">
<span class="material-symbols-outlined text-[20px]">send</span>
</button>
</div>
</div>
<!-- SideNav Footer -->
<div class="border-t border-outline-variant flex">
<button class="flex-1 py-3 flex items-center justify-center gap-2 text-on-surface-variant hover:bg-surface-container-high transition-colors">
<span class="material-symbols-outlined text-[18px]">account_circle</span>
<span class="font-label-caps text-[11px]">Profile</span>
</button>
<div class="w-px bg-outline-variant"></div>
<button class="flex-1 py-3 flex items-center justify-center gap-2 text-error hover:bg-error-container/20 transition-colors">
<span class="material-symbols-outlined text-[18px]">logout</span>
<span class="font-label-caps text-[11px]">Leave</span>
</button>
</div>
</aside>
</div>
<!-- Bottom Action Bar (Voting) -->
<div class="absolute bottom-0 left-0 w-full md:w-[calc(100%-20rem)] bg-surface-container-low/90 backdrop-blur-xl border-t border-outline-variant p-4 z-40">
<div class="max-w-4xl mx-auto flex items-center justify-between gap-4">
<div class="hidden sm:block">
<span class="font-mono-ui text-mono-ui text-on-surface-variant">Waiting for nomination...</span>
</div>
<div class="flex gap-4 flex-1 sm:flex-none justify-end">
<button class="flex-1 sm:flex-none px-6 py-3 rounded-lg border border-error text-error font-label-caps text-label-caps tracking-wider opacity-50 cursor-not-allowed flex items-center justify-center gap-2 hover:bg-error/10 transition-colors" disabled="">
<span class="material-symbols-outlined text-[18px]">close</span>
                    REJECT SPRINT PLAN
                </button>
<button class="flex-1 sm:flex-none px-6 py-3 rounded-lg bg-secondary text-on-secondary font-label-caps text-label-caps tracking-wider opacity-50 cursor-not-allowed flex items-center justify-center gap-2 hover:bg-secondary-fixed transition-colors shadow-[0_0_15px_rgba(74,225,118,0.2)]" disabled="">
<span class="material-symbols-outlined text-[18px]">check</span>
                    APPROVE SPRINT PLAN
                </button>
</div>
</div>
</div>
</body></html>