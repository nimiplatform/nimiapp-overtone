# Overtone

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

Overtone is an AI music creation and editing app in the Nimi ecosystem. The owner has delegated product and design decisions and judges success by whether it is fun, surprising, and enables musical exploration that was previously difficult. The product is at an early stage.

## Users

The owner has confirmed the music exploration direction: curious music listeners and creators, including people who do not know production terminology. Their starting point can be a scene, an emotion, or an improbable combination.

## Current Design Mandate

The owner explicitly judged the first playable UI/UX too weak and authorized a complete visual and interaction redesign without being bound by the existing style. Preserve the approved music exploration mechanism and actual platform boundaries; the prior copper glass identity, form-column layout, welcome page and equal proposal cards are not constraints. Build a distinctive, directly playable creation surface.

## Operating Context

A React application inside the Desktop-supervised Nimi Electron carrier. One active local creative session. English and Chinese. AI configuration and execution are supplied through the protected Nimi Local App client.

## Capabilities and Constraints

The creation flow moves from 20-second auditions into a separate full-song draft: a locked textual direction, a 90/120/180-second target, six to eight editable lyrical sections, and explicit music rendering. The protected duration contract is supplied by published SDK 0.11.0 and Kit 0.7.0, with no app-level workspace links. Development remains Desktop-supervised. Published App Tools 0.5.1 supplies the matching SDK/Kit cohort. Production dependency preflight and Windows packaging are verified; installation and launch acceptance belong to a separate coordinated session. Completed audio artifacts support playback and trim preview. Audio reference, extend, remix and Realm publication are unavailable on this protected contract. New interpretations can use a take's text, but must not claim to transform its audio. Generated audio must be decoded before being presented as a take. Completed job references and author snapshots remain recoverable when loading or decoding fails, without regenerating music. Writing uses cancelable protected streams with a 90-second waiting deadline; publication has no action surface until admitted. Local draft metadata is app-owned; Runtime execution, model routing and identity remain platform-owned.

## Product Principles

- Make the first idea easy and the second possibility surprising.
- Let people choose by feeling before asking for production details.
- Preserve every audible version and make comparison immediate.
- Distinguish an idea, an AI proposal, and an actual recording.
- A failed experiment keeps the idea intact and offers a clear next action.

## Evidence on Hand

Existing implementation and canonical authority under `.nimi/spec/overtone/canonical`. No usage metrics, sample recordings, customer endorsements or completed generation are assumed. This file is a design context record; canonical rules remain under `.nimi/spec`.
