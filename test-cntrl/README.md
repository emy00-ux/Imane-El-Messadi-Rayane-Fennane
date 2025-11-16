README – Projet EMSI 2025/2026

Piano Virtuel Interactif contrôlé par la main via Handpose & Synthétiseur Pro-54 (WAM)

1. Introduction

Ce projet consiste à développer une application web interactive permettant de jouer du piano uniquement avec les mouvements de la main devant une caméra.
L’objectif est de combiner :

détection automatique de la main,

interaction gestuelle naturelle,

génération de son MIDI via un synthétiseur virtuel professionnel,

interface graphique en temps réel.

Le projet utilise des technologies modernes (p5.js, ml5.js, WebAudio Modules) et met en pratique plusieurs notions vues en cours.

2. Objectifs du projet

Détecter la main en temps réel via la webcam.

Identifier la position de l’index et du pouce.

Utiliser la distance pouce-index pour activer/désactiver le piano (« pinch gesture »).

Générer un piano virtuel complet de 71 touches (blanches + noires).

Jouer des notes MIDI en déplaçant l’index horizontalement.

Contrôler le filtre (cutoff) du synthétiseur selon la hauteur de la main.

Intégrer le synthétiseur Pro-54 (WAM) pour produire un vrai son musical.

Proposer une interface fluide, intuitive et exploitable en temps réel.

3. Technologies utilisées
Bibliothèques et frameworks

p5.js : affichage, gestion du canvas, dessin graphique.

ml5.js (Handpose) : détection de la main (21 landmarks).

WebAudio Modules (WAM) : synthétiseur Pro-54, génération MIDI.

JavaScript ES6 : logique, interactions utilisateur.

HTML/CSS : structure et mise en page du synthé.


5. Détection de la main (Handpose)

Le modèle Handpose (ml5.js / TensorFlow Lite) détecte 21 points clés de la main.
Les plus importants ici :

Index tip (landmark 8)

Thumb tip (landmark 4)

Le système calcule la distance entre ces deux points pour détecter un pinch.

6. Logique d’activation du piano ON/OFF
Règles :

Pinch (pouce + index collés) → piano ON

Main ouverte (distance large) → piano OFF

Cela permet une activation intuitive, sans boutons physiques.

Un indicateur visuel est affiché sur l’interface :

Vert : PIANO ON

Rouge : PIANO OFF

7. Génération du piano virtuel (71 touches)

Le piano est formé :

de touches blanches (calculées dynamiquement selon la largeur du canvas),

de touches noires (positionnées entre les blanches selon le cycle musical),

de 71 notes MIDI consécutives à partir de START_MIDI_NOTE = 36.

Le dessin du piano est entièrement généré en JavaScript.

8. Interaction musicale via la main

Quand le piano est activé, l’utilisateur peut jouer une note en déplaçant son index horizontalement.

L’écran est divisé en 71 zones verticales.
Chaque zone correspond à une note MIDI unique.

Logique :

Si la main change de zone → la note précédente est coupée

La nouvelle note est jouée immédiatement via MIDI

9. Synthétiseur Pro-54 (WAM)

Le synthétiseur utilisé est un module WebAudio (WAM) compilé en WebAssembly.

Caractéristiques :

Oscillateurs multiples

Enveloppes ADSR complètes

Filtre résonant (cutoff, resonance)

Modulation

Effets intégrés

Les notes sont envoyées via MIDI :

0x90 → Note ON

0x80 → Note OFF

10. Contrôle du cutoff par la hauteur de la main

La position verticale de l’index est convertie en une valeur comprise entre :

CUTOFF_MIN = 0

CUTOFF_MAX = 200

Plus la main monte : son plus brillant
Plus la main descend : son plus sombre

Le cutoff est mis à jour en temps réel.

11. Fonction « souris pass-through »

Un bouton permet d’activer/désactiver la prise en compte de la souris sur le canvas.

Ce mode permet :

soit d’utiliser le canvas normalement,

soit de cliquer directement sur les boutons du synthétiseur Pro-54 même s'il est derrière le canvas.

Ceci améliore grandement l’ergonomie.

12. Scénario d'utilisation

L’utilisateur lance l’application.

La webcam s’active automatiquement.

Le synthétiseur apparaît en haut.

Le piano apparaît en bas.

L’utilisateur place sa main devant la caméra.

Avec un pinch, il active le piano.

Il déplace l’index horizontalement pour jouer des notes.

Il monte/descend la main pour modifier le cutoff.

En ouvrant la main, il désactive le piano.

13. Améliorations possibles

Détection d’accords (plusieurs doigts).

Ajout d’un mode deux mains (main droite = notes / main gauche = volume).

Enregistrement des mélodies.

Visualisation graphique plus avancée.

Support OSC / MIDI externe.

FIN DU README