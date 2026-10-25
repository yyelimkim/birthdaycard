# Felt pop-up birthday card

A 3D birthday card interaction made entirely of "felt", built with Three.js (no build step).

1. **You've got mail!** A felt envelope slides in with a dissolve and a mail chime.
2. **Tap the envelope.** The flap peels open and the card slides out.
3. **Tap the card.** It tilts down and the pop-up springs open, with confetti and a music-box tune.
4. **Drag** to orbit around the card. **Tap** the open card to fold it fully shut; tap again to pop it fully open.

## Run

```sh
python3 -m http.server 8123
# open http://localhost:8123
```

## Design source (Figma)

The pop-up scene comes from the "Back panel art" and "Happy Birthday banner" frames in the Figma file.
Each chunk (hair, face, cake tier, star…) is rendered into `assets/figma/atlas.png`, with its position in
`assets/figma/chunks.json`. `js/figma-felt.js` traces each chunk's outline into a thick felt cutout, prints the art
on its face and gives it a soft drop shadow; `js/card.js` decides which pop-up fold each chunk sits on.
To pick up design edits, re-export the atlas + chunks from Figma.

Easter egg: tap the candle flame to blow it out, tap again to relight it.

## Structure

- `js/figma-felt.js`: turns the Figma atlas chunks into felt pieces
- `js/felt.js`: felt toolkit. Extruded cutouts with procedurally painted textures (fibres, running stitches, embroidery text), sheen material and shared fibre bump map
- `js/card.js`: the card. Base, back panel, cover, and the parallel-fold pop-up layers (friends, cake, banner)
- `js/envelope.js`: felt envelope, hinged flap, noise dissolve shader
- `js/confetti.js`: instanced felt confetti
- `js/audio.js`: all sounds synthesised with WebAudio (no audio files)
- `js/main.js`: scene, camera moves, state machine and input

Note: browsers block audio until the first tap, so the arrival chime plays on the first interaction if autoplay is blocked.
