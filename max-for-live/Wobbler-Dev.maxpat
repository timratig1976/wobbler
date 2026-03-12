{
	"patcher": {
		"fileversion": 1,
		"appversion": {
			"major": 9,
			"minor": 0,
			"revision": 0,
			"architecture": "x64",
			"modernui": 1
		},
		"classnamespace": "box",
		"rect": [100, 100, 900, 520],
		"bglocked": 0,
		"openinpresentation": 0,
		"default_fontsize": 12.0,
		"default_fontface": 0,
		"default_fontname": "Arial",
		"gridonopen": 1,
		"gridsize": [15.0, 15.0],
		"gridsnaponopen": 1,
		"objectsnaponopen": 1,
		"statusbarvisible": 2,
		"toolbars": 1,
		"boxes": [
			{
				"box": {
					"id": "obj-1",
					"maxclass": "comment",
					"text": "Wobbler Phase 1 — Dev Test Wrapper",
					"fontsize": 14.0,
					"fontface": 1,
					"patching_rect": [30.0, 15.0, 380.0, 22.0]
				}
			},
			{
				"box": {
					"id": "obj-2",
					"maxclass": "comment",
					"text": "SETUP: rnbo~ auto-loads wobbler-voice.rnbo on open (and hot-reloads when saved). After first load, manually wire: midiin→rnbo~ MIDI inlet | rnbo~ out1→*~left | rnbo~ out2→*~right. Then enable DSP (power button) and play.",
					"patching_rect": [30.0, 40.0, 780.0, 22.0]
				}
			},
			{
				"box": {
					"id": "obj-3",
					"maxclass": "newobj",
					"text": "midiin",
					"numinlets": 0,
					"numoutlets": 1,
					"outlettype": ["int"],
					"patching_rect": [30.0, 80.0, 50.0, 22.0]
				}
			},
			{
				"box": {
					"id": "obj-4",
					"maxclass": "newobj",
					"text": "rnbo~ @polyphony 8",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [""],
					"patching_rect": [30.0, 130.0, 320.0, 22.0]
				}
			},
			{
				"box": {
					"id": "obj-5",
					"maxclass": "newobj",
					"text": "*~ 0.25",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": ["signal"],
					"patching_rect": [30.0, 190.0, 55.0, 22.0]
				}
			},
			{
				"box": {
					"id": "obj-6",
					"maxclass": "newobj",
					"text": "*~ 0.25",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": ["signal"],
					"patching_rect": [105.0, 190.0, 55.0, 22.0]
				}
			},
			{
				"box": {
					"id": "obj-7",
					"maxclass": "newobj",
					"text": "dac~",
					"numinlets": 2,
					"numoutlets": 0,
					"outlettype": [],
					"patching_rect": [30.0, 240.0, 40.0, 22.0]
				}
			},
			{
				"box": {
					"id": "obj-8",
					"maxclass": "newobj",
					"text": "scope~ @size 180 80",
					"numinlets": 2,
					"numoutlets": 0,
					"outlettype": [],
					"patching_rect": [30.0, 295.0, 180.0, 80.0]
				}
			},
			{
				"box": {
					"id": "obj-9",
					"maxclass": "comment",
					"text": "— PARAM CONTROL (send to all 8 voices) —",
					"fontface": 1,
					"patching_rect": [440.0, 80.0, 340.0, 22.0]
				}
			},
			{
				"box": {
					"id": "obj-10",
					"maxclass": "number",
					"minimum": 1,
					"maximum": 4000,
					"numinlets": 2,
					"numoutlets": 2,
					"outlettype": ["int", "bang"],
					"patching_rect": [440.0, 110.0, 80.0, 22.0]
				}
			},
			{
				"box": {
					"id": "obj-11",
					"maxclass": "message",
					"text": "attack $1",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [""],
					"patching_rect": [440.0, 140.0, 80.0, 22.0]
				}
			},
			{
				"box": {
					"id": "obj-12",
					"maxclass": "number",
					"minimum": 1,
					"maximum": 4000,
					"numinlets": 2,
					"numoutlets": 2,
					"outlettype": ["int", "bang"],
					"patching_rect": [540.0, 110.0, 80.0, 22.0]
				}
			},
			{
				"box": {
					"id": "obj-13",
					"maxclass": "message",
					"text": "decay $1",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [""],
					"patching_rect": [540.0, 140.0, 80.0, 22.0]
				}
			},
			{
				"box": {
					"id": "obj-14",
					"maxclass": "flonum",
					"minimum": 0.0,
					"maximum": 1.0,
					"numinlets": 2,
					"numoutlets": 2,
					"outlettype": ["float", "bang"],
					"patching_rect": [640.0, 110.0, 80.0, 22.0]
				}
			},
			{
				"box": {
					"id": "obj-15",
					"maxclass": "message",
					"text": "sustain $1",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [""],
					"patching_rect": [640.0, 140.0, 80.0, 22.0]
				}
			},
			{
				"box": {
					"id": "obj-16",
					"maxclass": "number",
					"minimum": 1,
					"maximum": 8000,
					"numinlets": 2,
					"numoutlets": 2,
					"outlettype": ["int", "bang"],
					"patching_rect": [740.0, 110.0, 80.0, 22.0]
				}
			},
			{
				"box": {
					"id": "obj-17",
					"maxclass": "message",
					"text": "release $1",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [""],
					"patching_rect": [740.0, 140.0, 80.0, 22.0]
				}
			},
			{
				"box": {
					"id": "obj-18",
					"maxclass": "comment",
					"text": "attack (ms)",
					"patching_rect": [440.0, 165.0, 80.0, 22.0]
				}
			},
			{
				"box": {
					"id": "obj-19",
					"maxclass": "comment",
					"text": "decay (ms)",
					"patching_rect": [540.0, 165.0, 80.0, 22.0]
				}
			},
			{
				"box": {
					"id": "obj-20",
					"maxclass": "comment",
					"text": "sustain (0-1)",
					"patching_rect": [640.0, 165.0, 80.0, 22.0]
				}
			},
			{
				"box": {
					"id": "obj-21",
					"maxclass": "comment",
					"text": "release (ms)",
					"patching_rect": [740.0, 165.0, 80.0, 22.0]
				}
			},
			{
				"box": {
					"id": "obj-22",
					"maxclass": "kslider",
					"numinlets": 2,
					"numoutlets": 2,
					"outlettype": ["int", "int"],
					"patching_rect": [440.0, 200.0, 336.0, 45.0]
				}
			},
			{
				"box": {
					"id": "obj-23",
					"maxclass": "newobj",
					"text": "makenote 80 500",
					"numinlets": 3,
					"numoutlets": 2,
					"outlettype": ["int", "int"],
					"patching_rect": [440.0, 260.0, 120.0, 22.0]
				}
			},
			{
				"box": {
					"id": "obj-24",
					"maxclass": "newobj",
					"text": "noteout",
					"numinlets": 3,
					"numoutlets": 0,
					"outlettype": [],
					"patching_rect": [440.0, 295.0, 60.0, 22.0]
				}
			},
			{
				"box": {
					"id": "obj-25",
					"maxclass": "comment",
					"text": "kslider → makenote → noteout → midiin loopback (needs IAC Driver or virtual MIDI)",
					"patching_rect": [440.0, 325.0, 440.0, 22.0]
				}
			},
			{
				"box": {
					"id": "obj-26",
					"maxclass": "comment",
					"text": "SIMPLER: patch kslider directly to rnbo~ if using internal MIDI routing",
					"patching_rect": [440.0, 350.0, 440.0, 22.0]
				}
			},
			{
				"box": {
					"id": "obj-27",
					"maxclass": "newobj",
					"text": "loadbang",
					"numinlets": 0,
					"numoutlets": 1,
					"outlettype": ["bang"],
					"patching_rect": [30.0, 80.0, 65.0, 22.0]
				}
			},
			{
				"box": {
					"id": "obj-28",
					"maxclass": "message",
					"text": "read wobbler-voice.rnbo",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [""],
					"patching_rect": [110.0, 80.0, 165.0, 22.0]
				}
			},
			{
				"box": {
					"id": "obj-29",
					"maxclass": "newobj",
					"text": "filewatcher wobbler-voice.rnbo",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": ["bang"],
					"patching_rect": [290.0, 80.0, 200.0, 22.0]
				}
			},
			{
				"box": {
					"id": "obj-30",
					"maxclass": "comment",
					"text": "↑ hot-reloads rnbo~ when wobbler-voice.rnbo is saved",
					"patching_rect": [290.0, 105.0, 280.0, 22.0]
				}
			}
		],
		"lines": [
			{
				"patchline": {
					"source": ["obj-27", 0],
					"destination": ["obj-28", 0]
				}
			},
			{
				"patchline": {
					"source": ["obj-29", 0],
					"destination": ["obj-28", 0]
				}
			},
			{
				"patchline": {
					"source": ["obj-28", 0],
					"destination": ["obj-4", 0]
				}
			},
			{
				"patchline": {
					"source": ["obj-5", 0],
					"destination": ["obj-7", 0]
				}
			},
			{
				"patchline": {
					"source": ["obj-6", 0],
					"destination": ["obj-7", 1]
				}
			},
			{
				"patchline": {
					"source": ["obj-5", 0],
					"destination": ["obj-8", 0]
				}
			},
			{
				"patchline": {
					"source": ["obj-10", 0],
					"destination": ["obj-11", 0]
				}
			},
			{
				"patchline": {
					"source": ["obj-11", 0],
					"destination": ["obj-4", 0]
				}
			},
			{
				"patchline": {
					"source": ["obj-12", 0],
					"destination": ["obj-13", 0]
				}
			},
			{
				"patchline": {
					"source": ["obj-13", 0],
					"destination": ["obj-4", 0]
				}
			},
			{
				"patchline": {
					"source": ["obj-14", 0],
					"destination": ["obj-15", 0]
				}
			},
			{
				"patchline": {
					"source": ["obj-15", 0],
					"destination": ["obj-4", 0]
				}
			},
			{
				"patchline": {
					"source": ["obj-16", 0],
					"destination": ["obj-17", 0]
				}
			},
			{
				"patchline": {
					"source": ["obj-17", 0],
					"destination": ["obj-4", 0]
				}
			},
			{
				"patchline": {
					"source": ["obj-22", 0],
					"destination": ["obj-23", 0]
				}
			},
			{
				"patchline": {
					"source": ["obj-23", 0],
					"destination": ["obj-24", 0]
				}
			},
			{
				"patchline": {
					"source": ["obj-23", 1],
					"destination": ["obj-24", 1]
				}
			}
		]
	}
}
