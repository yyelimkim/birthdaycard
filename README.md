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

## Structure

- `js/felt.js`: felt toolkit. Extruded cutouts with procedurally painted textures (fibres, running stitches, embroidery text), sheen material and shared fibre bump map
- `js/card.js`: the card. Base, back panel, cover, and the parallel-fold pop-up layers (friends, cake, banner)
- `js/envelope.js`: felt envelope, hinged flap, noise dissolve shader
- `js/confetti.js`: instanced felt confetti
- `js/audio.js`: all sounds synthesised with WebAudio (no audio files)
- `js/main.js`: scene, camera moves, state machine and input

Note: browsers block audio until the first tap, so the arrival chime plays on the first interaction if autoplay is blocked.
