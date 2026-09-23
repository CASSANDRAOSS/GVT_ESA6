"use strict";


// --------------------------------------------------
// 1. ELEMENTE AUS DER HTML-SEITE AUSWÄHLEN
// --------------------------------------------------

const canvas =
    document.getElementById("webglCanvas");

const statusanzeige =
    document.getElementById("webglStatus");

const schrittButton =
    document.getElementById("schrittButton");

const automatikButton =
    document.getElementById("automatikButton");

const torusButton =
    document.getElementById("torusButton");

const zuruecksetzenButton =
    document.getElementById("zuruecksetzenButton");

const bewegungsAnzeige =
    document.getElementById("bewegungsAnzeige");

const torusAnzeige =
    document.getElementById("torusAnzeige");


// --------------------------------------------------
// 2. WEBGL VORBEREITEN
// --------------------------------------------------

const gl =
    canvas.getContext("webgl");

if (!gl) {
    statusanzeige.textContent =
        "WebGL wird von diesem Browser leider nicht unterstützt.";

    throw new Error(
        "WebGL konnte nicht gestartet werden."
    );
}


// --------------------------------------------------
// 3. SHADER
// --------------------------------------------------

const vertexShaderQuelltext = `
    attribute vec3 aPosition;
    attribute vec3 aFarbe;

    uniform mat4 uMvpMatrix;

    varying vec3 vFarbe;

    void main() {
        gl_Position =
            uMvpMatrix * vec4(aPosition, 1.0);

        vFarbe = aFarbe;
    }
`;

const fragmentShaderQuelltext = `
    precision mediump float;

    varying vec3 vFarbe;

    void main() {
        gl_FragColor = vec4(vFarbe, 1.0);
    }
`;


// Erstellt einen Shader und prüft,
// ob dieser fehlerfrei übersetzt wurde.
function shaderErstellen(typ, quelltext) {

    const shader = gl.createShader(typ);

    gl.shaderSource(shader, quelltext);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(
        shader,
        gl.COMPILE_STATUS
    )) {
        const meldung =
            gl.getShaderInfoLog(shader);

        gl.deleteShader(shader);

        throw new Error(
            "Fehler im Shader: " + meldung
        );
    }

    return shader;
}


const vertexShader = shaderErstellen(
    gl.VERTEX_SHADER,
    vertexShaderQuelltext
);

const fragmentShader = shaderErstellen(
    gl.FRAGMENT_SHADER,
    fragmentShaderQuelltext
);

const programm = gl.createProgram();

gl.attachShader(programm, vertexShader);
gl.attachShader(programm, fragmentShader);
gl.linkProgram(programm);

if (!gl.getProgramParameter(
    programm,
    gl.LINK_STATUS
)) {
    throw new Error(
        "Das Shaderprogramm konnte nicht verbunden werden: "
        + gl.getProgramInfoLog(programm)
    );
}

gl.useProgram(programm);


// Positionen der Attribute und Uniforms
const positionAttribut =
    gl.getAttribLocation(
        programm,
        "aPosition"
    );

const farbeAttribut =
    gl.getAttribLocation(
        programm,
        "aFarbe"
    );

const mvpUniform =
    gl.getUniformLocation(
        programm,
        "uMvpMatrix"
    );


// Tiefentest einschalten, damit weiter hinten
// liegende Flächen verdeckt werden.
gl.enable(gl.DEPTH_TEST);


// --------------------------------------------------
// 4. HILFSFUNKTIONEN FÜR VEKTOREN
// --------------------------------------------------

function subtrahieren(a, b) {
    return [
        a[0] - b[0],
        a[1] - b[1],
        a[2] - b[2]
    ];
}


function skalarprodukt(a, b) {
    return (
        a[0] * b[0]
        + a[1] * b[1]
        + a[2] * b[2]
    );
}


function kreuzprodukt(a, b) {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
}


function normieren(vektor) {

    const laenge = Math.hypot(
        vektor[0],
        vektor[1],
        vektor[2]
    );

    if (laenge === 0) {
        return [0, 0, 0];
    }

    return [
        vektor[0] / laenge,
        vektor[1] / laenge,
        vektor[2] / laenge
    ];
}


// --------------------------------------------------
// 5. HILFSFUNKTIONEN FÜR MATRIZEN
// --------------------------------------------------

// Erzeugt eine Einheitsmatrix.
function einheitsmatrix() {
    return new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ]);
}


// Multipliziert zwei 4-mal-4-Matrizen.
function matrizenMultiplizieren(a, b) {

    const ergebnis =
        new Float32Array(16);

    for (let spalte = 0; spalte < 4; spalte++) {

        for (let zeile = 0; zeile < 4; zeile++) {

            ergebnis[spalte * 4 + zeile] =
                a[0 * 4 + zeile]
                    * b[spalte * 4 + 0]
                + a[1 * 4 + zeile]
                    * b[spalte * 4 + 1]
                + a[2 * 4 + zeile]
                    * b[spalte * 4 + 2]
                + a[3 * 4 + zeile]
                    * b[spalte * 4 + 3];
        }
    }

    return ergebnis;
}


// Verschiebungsmatrix
function verschiebungsmatrix(x, y, z) {

    return new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        x, y, z, 1
    ]);
}


// Skalierungsmatrix
function skalierungsmatrix(x, y, z) {

    return new Float32Array([
        x, 0, 0, 0,
        0, y, 0, 0,
        0, 0, z, 0,
        0, 0, 0, 1
    ]);
}


// Drehung um die X-Achse
function rotationsmatrixX(winkel) {

    const cosinus = Math.cos(winkel);
    const sinus = Math.sin(winkel);

    return new Float32Array([
        1, 0, 0, 0,
        0, cosinus, sinus, 0,
        0, -sinus, cosinus, 0,
        0, 0, 0, 1
    ]);
}


// Drehung um die Y-Achse
function rotationsmatrixY(winkel) {

    const cosinus = Math.cos(winkel);
    const sinus = Math.sin(winkel);

    return new Float32Array([
        cosinus, 0, -sinus, 0,
        0, 1, 0, 0,
        sinus, 0, cosinus, 0,
        0, 0, 0, 1
    ]);
}


// Drehung um die Z-Achse
function rotationsmatrixZ(winkel) {

    const cosinus = Math.cos(winkel);
    const sinus = Math.sin(winkel);

    return new Float32Array([
        cosinus, sinus, 0, 0,
        -sinus, cosinus, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ]);
}


// Erstellt die Model-Matrix eines Objektes.

// Entsprechend der Lerneinheit TFM wird ein
// Objekt zuerst skaliert, danach gedreht und
// anschließend an seine Position verschoben.
function modelMatrixErstellen(
    position,
    rotation,
    skalierung
) {

    const verschiebung =
        verschiebungsmatrix(
            position[0],
            position[1],
            position[2]
        );

    const rotationX =
        rotationsmatrixX(rotation[0]);

    const rotationY =
        rotationsmatrixY(rotation[1]);

    const rotationZ =
        rotationsmatrixZ(rotation[2]);

    const skalierungMatrix =
        skalierungsmatrix(
            skalierung[0],
            skalierung[1],
            skalierung[2]
        );

    let modelMatrix = verschiebung;

    modelMatrix = matrizenMultiplizieren(
        modelMatrix,
        rotationX
    );

    modelMatrix = matrizenMultiplizieren(
        modelMatrix,
        rotationY
    );

    modelMatrix = matrizenMultiplizieren(
        modelMatrix,
        rotationZ
    );

    modelMatrix = matrizenMultiplizieren(
        modelMatrix,
        skalierungMatrix
    );

    return modelMatrix;
}


// Perspektivische Projektion
function perspektive(
    sichtwinkel,
    seitenverhaeltnis,
    nah,
    fern
) {

    const faktor =
        1 / Math.tan(sichtwinkel / 2);

    return new Float32Array([
        faktor / seitenverhaeltnis,
        0,
        0,
        0,

        0,
        faktor,
        0,
        0,

        0,
        0,
        (fern + nah) / (nah - fern),
        -1,

        0,
        0,
        2 * fern * nah / (nah - fern),
        0
    ]);
}


// Richtet die Kamera auf einen Zielpunkt aus.
function lookAt(eye, ziel, up) {

    const vorwaerts = normieren(
        subtrahieren(ziel, eye)
    );

    const rechts = normieren(
        kreuzprodukt(vorwaerts, up)
    );

    const oben =
        kreuzprodukt(rechts, vorwaerts);

    return new Float32Array([
        rechts[0],
        oben[0],
        -vorwaerts[0],
        0,

        rechts[1],
        oben[1],
        -vorwaerts[1],
        0,

        rechts[2],
        oben[2],
        -vorwaerts[2],
        0,

        -skalarprodukt(rechts, eye),
        -skalarprodukt(oben, eye),
        skalarprodukt(vorwaerts, eye),
        1
    ]);
}


// --------------------------------------------------
// 6. HILFSFUNKTIONEN FÜR DIE GEOMETRIE
// --------------------------------------------------

// Fügt ein Dreieck mit drei Farben hinzu.
function dreieckHinzufuegen(
    positionen,
    farben,
    a,
    b,
    c,
    farbeA,
    farbeB,
    farbeC
) {

    positionen.push(
        ...a,
        ...b,
        ...c
    );

    farben.push(
        ...farbeA,
        ...farbeB,
        ...farbeC
    );
}


// Hellt eine Farbe leicht auf oder dunkelt sie ab.
function farbeAnpassen(farbe, faktor) {

    return [
        Math.min(1, farbe[0] * faktor),
        Math.min(1, farbe[1] * faktor),
        Math.min(1, farbe[2] * faktor)
    ];
}


// --------------------------------------------------
// 7. KUGELGEOMETRIE
// --------------------------------------------------

function kugelGeometrieErstellen(
    grundfarbe,
    breitengrade = 18,
    laengengrade = 24
) {

    const positionen = [];
    const farben = [];

    for (
        let breite = 0;
        breite < breitengrade;
        breite++
    ) {

        const phi1 =
            -Math.PI / 2
            + breite
                / breitengrade
                * Math.PI;

        const phi2 =
            -Math.PI / 2
            + (breite + 1)
                / breitengrade
                * Math.PI;

        for (
            let laenge = 0;
            laenge < laengengrade;
            laenge++
        ) {

            const theta1 =
                laenge
                / laengengrade
                * Math.PI
                * 2;

            const theta2 =
                (laenge + 1)
                / laengengrade
                * Math.PI
                * 2;

            const a = [
                Math.cos(phi1) * Math.cos(theta1),
                Math.sin(phi1),
                Math.cos(phi1) * Math.sin(theta1)
            ];

            const b = [
                Math.cos(phi1) * Math.cos(theta2),
                Math.sin(phi1),
                Math.cos(phi1) * Math.sin(theta2)
            ];

            const c = [
                Math.cos(phi2) * Math.cos(theta2),
                Math.sin(phi2),
                Math.cos(phi2) * Math.sin(theta2)
            ];

            const d = [
                Math.cos(phi2) * Math.cos(theta1),
                Math.sin(phi2),
                Math.cos(phi2) * Math.sin(theta1)
            ];

            const farbeA = farbeAnpassen(
                grundfarbe,
                0.82 + (a[1] + 1) * 0.14
            );

            const farbeB = farbeAnpassen(
                grundfarbe,
                0.82 + (b[1] + 1) * 0.14
            );

            const farbeC = farbeAnpassen(
                grundfarbe,
                0.82 + (c[1] + 1) * 0.14
            );

            const farbeD = farbeAnpassen(
                grundfarbe,
                0.82 + (d[1] + 1) * 0.14
            );

            dreieckHinzufuegen(
                positionen,
                farben,
                a,
                b,
                c,
                farbeA,
                farbeB,
                farbeC
            );

            dreieckHinzufuegen(
                positionen,
                farben,
                a,
                c,
                d,
                farbeA,
                farbeC,
                farbeD
            );
        }
    }

    return {
        positionen: positionen,
        farben: farben,
        modus: gl.TRIANGLES
    };
}


// --------------------------------------------------
// 8. TORUSGEOMETRIE
// --------------------------------------------------

function torusGeometrieErstellen(
    grosserRadius = 1.05,
    kleinerRadius = 0.24,
    segmenteAussen = 48,
    segmenteInnen = 18
) {

    const positionen = [];
    const farben = [];

    function torusPunkt(u, v) {

        return [
            (
                grosserRadius
                + kleinerRadius * Math.cos(v)
            ) * Math.cos(u),

            kleinerRadius * Math.sin(v),

            (
                grosserRadius
                + kleinerRadius * Math.cos(v)
            ) * Math.sin(u)
        ];
    }


    function torusFarbe(u, v) {

        const mischung =
            (Math.sin(u) + 1) / 2;

        const helligkeit =
            0.88
            + 0.12 * Math.cos(v);

        const tuerkis = [
            0.16,
            0.60,
            0.60
        ];

        const orange = [
            0.95,
            0.50,
            0.18
        ];

        return [
            (
                tuerkis[0] * (1 - mischung)
                + orange[0] * mischung
            ) * helligkeit,

            (
                tuerkis[1] * (1 - mischung)
                + orange[1] * mischung
            ) * helligkeit,

            (
                tuerkis[2] * (1 - mischung)
                + orange[2] * mischung
            ) * helligkeit
        ];
    }


    for (
        let aussen = 0;
        aussen < segmenteAussen;
        aussen++
    ) {

        const u1 =
            aussen
            / segmenteAussen
            * Math.PI
            * 2;

        const u2 =
            (aussen + 1)
            / segmenteAussen
            * Math.PI
            * 2;

        for (
            let innen = 0;
            innen < segmenteInnen;
            innen++
        ) {

            const v1 =
                innen
                / segmenteInnen
                * Math.PI
                * 2;

            const v2 =
                (innen + 1)
                / segmenteInnen
                * Math.PI
                * 2;

            const a = torusPunkt(u1, v1);
            const b = torusPunkt(u2, v1);
            const c = torusPunkt(u2, v2);
            const d = torusPunkt(u1, v2);

            const farbeA = torusFarbe(u1, v1);
            const farbeB = torusFarbe(u2, v1);
            const farbeC = torusFarbe(u2, v2);
            const farbeD = torusFarbe(u1, v2);

            dreieckHinzufuegen(
                positionen,
                farben,
                a,
                b,
                c,
                farbeA,
                farbeB,
                farbeC
            );

            dreieckHinzufuegen(
                positionen,
                farben,
                a,
                c,
                d,
                farbeA,
                farbeC,
                farbeD
            );
        }
    }

    return {
        positionen: positionen,
        farben: farben,
        modus: gl.TRIANGLES
    };
}


// --------------------------------------------------
// 9. GITTEREBENE
// --------------------------------------------------

function gitterGeometrieErstellen() {

    const positionen = [];
    const farben = [];

    const groesse = 5;
    const abstand = 0.5;
    const hoehe = -2.15;

    const hauptfarbe = [
        0.24,
        0.55,
        0.58
    ];

    const nebenfarbe = [
        0.52,
        0.73,
        0.72
    ];

    for (
        let wert = -groesse;
        wert <= groesse;
        wert += abstand
    ) {

        const istHauptlinie =
            Math.abs(wert % 1) < 0.001;

        const farbe =
            istHauptlinie
                ? hauptfarbe
                : nebenfarbe;

        // Linie parallel zur X-Achse
        positionen.push(
            -groesse, hoehe, wert,
            groesse, hoehe, wert
        );

        farben.push(
            ...farbe,
            ...farbe
        );

        // Linie parallel zur Z-Achse
        positionen.push(
            wert, hoehe, -groesse,
            wert, hoehe, groesse
        );

        farben.push(
            ...farbe,
            ...farbe
        );
    }

    return {
        positionen: positionen,
        farben: farben,
        modus: gl.LINES
    };
}


// --------------------------------------------------
// 10. WEBGL-MODELLE ERSTELLEN
// --------------------------------------------------

function modellErstellen(geometrie) {

    const positionsPuffer =
        gl.createBuffer();

    gl.bindBuffer(
        gl.ARRAY_BUFFER,
        positionsPuffer
    );

    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(
            geometrie.positionen
        ),
        gl.STATIC_DRAW
    );


    const farbPuffer =
        gl.createBuffer();

    gl.bindBuffer(
        gl.ARRAY_BUFFER,
        farbPuffer
    );

    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(
            geometrie.farben
        ),
        gl.STATIC_DRAW
    );


    return {
        positionsPuffer: positionsPuffer,
        farbPuffer: farbPuffer,
        anzahl:
            geometrie.positionen.length / 3,
        modus: geometrie.modus
    };
}


// Farben der vier persönlichen Perlen
const farbeCassandra = [
    0.17,
    0.68,
    0.68
];

const farbeJanine = [
    0.91,
    0.47,
    0.61
];

const farbeKlopsi = [
    0.86,
    0.72,
    0.49
];

const farbeLeo = [
    0.16,
    0.28,
    0.40
];


const gitterModell =
    modellErstellen(
        gitterGeometrieErstellen()
    );

const torusModell =
    modellErstellen(
        torusGeometrieErstellen()
    );

const perlenModelle = [
    modellErstellen(
        kugelGeometrieErstellen(
            farbeCassandra
        )
    ),

    modellErstellen(
        kugelGeometrieErstellen(
            farbeJanine
        )
    ),

    modellErstellen(
        kugelGeometrieErstellen(
            farbeKlopsi
        )
    ),

    modellErstellen(
        kugelGeometrieErstellen(
            farbeLeo
        )
    )
];


// --------------------------------------------------
// START EA6_BEWEGUNG_DER_VIER_KUGELN
// --------------------------------------------------

// Gemeinsamer Winkel der vier Perlen
let perlenWinkel = 0;


// Radius und Mittelpunkt der Kreisbahn.
// Der Mittelpunkt liegt seitlich vom Torus.
// Dadurch führt die Bahn durch dessen Öffnung.
const bahnRadius = 1.8;
const bahnMittelpunktX = 1.8;


// Jede Perle beginnt um 90 Grad versetzt.
// Dadurch bleiben ihre Abstände immer gleich.
const phasen = [
    0,
    Math.PI / 2,
    Math.PI,
    Math.PI * 1.5
];


// Berechnet die Position einer Perle
// auf ihrer gemeinsamen Kreisbahn.
function perlenPositionBerechnen(index) {

    const winkel =
        perlenWinkel + phasen[index];

    const x =
        bahnMittelpunktX
        + bahnRadius * Math.cos(winkel);

    const y =
        bahnRadius * Math.sin(winkel);

    const z = 0;

    return [x, y, z];
}


// Verändert den gemeinsamen Winkel.
// Alle vier Perlen bewegen sich dadurch
// gleichzeitig ein Stück weiter.
function bewegungWeiter(schritt) {

    perlenWinkel += schritt;

    if (torusDrehungAktiv) {
        torusWinkel += schritt;
    }

    anzeigenAktualisieren();
    szeneZeichnen();
}

// --------------------------------------------------
// END EA6_BEWEGUNG_DER_VIER_KUGELN
// --------------------------------------------------


// --------------------------------------------------
// START EA6_ERWEITERUNG_ANIMIERTER_TORUS
// --------------------------------------------------

// Der Torus dreht sich synchron zur Bewegung
// der Perlen um mehrere Achsen.
let torusWinkel = 0;
let torusDrehungAktiv = true;


// Erstellt die aktuelle Model-Matrix des Torus.
function torusMatrixBerechnen() {

    // Neben der fortlaufenden Drehung um die
    // Y-Achse wird der Torus leicht um die
    // X- und Z-Achse bewegt.
    const rotationX =
        0.12
        + 0.10 * Math.sin(
            torusWinkel * 0.7
        );

    const rotationY =
        torusWinkel * 0.75;

    const rotationZ =
        0.08 * Math.cos(
            torusWinkel * 0.6
        );

    return modelMatrixErstellen(
        [0, 0, 0],
        [
            rotationX,
            rotationY,
            rotationZ
        ],
        [1.15, 1.15, 1.15]
    );
}


// Schaltet die zusätzliche Torusdrehung um.
function torusDrehungUmschalten() {

    torusDrehungAktiv =
        !torusDrehungAktiv;

    torusButton.setAttribute(
        "aria-pressed",
        String(torusDrehungAktiv)
    );

    torusButton.textContent =
        torusDrehungAktiv
            ? "Torusdrehung anhalten"
            : "Torusdrehung einschalten";

    torusAnzeige.textContent =
        torusDrehungAktiv
            ? "Torusdrehung ist eingeschaltet."
            : "Torusdrehung ist angehalten.";

    szeneZeichnen();
}

// --------------------------------------------------
// END EA6_ERWEITERUNG_ANIMIERTER_TORUS
// --------------------------------------------------


// --------------------------------------------------
// 11. KAMERA UND PROJEKTION
// --------------------------------------------------

// Die Kamera bleibt in dieser Aufgabe fest.
// Im Unterschied zu Aufgabe 5 bewegen sich
// diesmal die Objekte innerhalb der Szene.
const kameraPosition = [
    5.0,
    3.0,
    6.5
];

const kameraZiel = [
    0.9,
    -0.1,
    0
];

const kameraOben = [
    0,
    1,
    0
];


// --------------------------------------------------
// 12. EIN MODELL ZEICHNEN
// --------------------------------------------------

function attributVerbinden(
    puffer,
    attribut
) {

    gl.bindBuffer(
        gl.ARRAY_BUFFER,
        puffer
    );

    gl.vertexAttribPointer(
        attribut,
        3,
        gl.FLOAT,
        false,
        0,
        0
    );

    gl.enableVertexAttribArray(
        attribut
    );
}


function modellZeichnen(
    modell,
    modelMatrix,
    viewMatrix,
    projektionsMatrix
) {

    const modelViewMatrix =
        matrizenMultiplizieren(
            viewMatrix,
            modelMatrix
        );

    const mvpMatrix =
        matrizenMultiplizieren(
            projektionsMatrix,
            modelViewMatrix
        );

    gl.uniformMatrix4fv(
        mvpUniform,
        false,
        mvpMatrix
    );

    attributVerbinden(
        modell.positionsPuffer,
        positionAttribut
    );

    attributVerbinden(
        modell.farbPuffer,
        farbeAttribut
    );

    gl.drawArrays(
        modell.modus,
        0,
        modell.anzahl
    );
}


// --------------------------------------------------
// 13. GESAMTE SZENE ZEICHNEN
// --------------------------------------------------

function szeneZeichnen() {

    gl.viewport(
        0,
        0,
        canvas.width,
        canvas.height
    );

    gl.clearColor(
        0.84,
        0.94,
        0.95,
        1
    );

    gl.clear(
        gl.COLOR_BUFFER_BIT
        | gl.DEPTH_BUFFER_BIT
    );


    const projektionsMatrix =
        perspektive(
            Math.PI / 3,
            canvas.width / canvas.height,
            0.1,
            40
        );

    const viewMatrix =
        lookAt(
            kameraPosition,
            kameraZiel,
            kameraOben
        );


    // Gitterebene zeichnen
    modellZeichnen(
        gitterModell,
        einheitsmatrix(),
        viewMatrix,
        projektionsMatrix
    );


    // Animierten Torus zeichnen
    modellZeichnen(
        torusModell,
        torusMatrixBerechnen(),
        viewMatrix,
        projektionsMatrix
    );


    // Die vier Perlen an ihren jeweils
    // berechneten Positionen zeichnen.
    for (
        let index = 0;
        index < perlenModelle.length;
        index++
    ) {

        const position =
            perlenPositionBerechnen(index);

        const perlenMatrix =
            modelMatrixErstellen(
                position,
                [0, 0, 0],
                [0.27, 0.27, 0.27]
            );

        modellZeichnen(
            perlenModelle[index],
            perlenMatrix,
            viewMatrix,
            projektionsMatrix
        );
    }
}


// --------------------------------------------------
// START EA6_INTERAKTION
// --------------------------------------------------

let automatikAktiv = false;
let letzterZeitpunkt = 0;


// Aktualisiert die sichtbaren Informationen.
function anzeigenAktualisieren() {

    const grad =
        (
            perlenWinkel
            * 180
            / Math.PI
        ) % 360;

    bewegungsAnzeige.textContent =
        automatikAktiv
            ? "Automatische Bewegung läuft · Winkel: "
                + Math.round(
                    (grad + 360) % 360
                )
                + "°"
            : "Bewegung angehalten · Winkel: "
                + Math.round(
                    (grad + 360) % 360
                )
                + "°";
}


// Startet oder stoppt die automatische Bewegung.
function automatikUmschalten() {

    automatikAktiv =
        !automatikAktiv;

    automatikButton.setAttribute(
        "aria-pressed",
        String(automatikAktiv)
    );

    automatikButton.textContent =
        automatikAktiv
            ? "Bewegung anhalten"
            : "Bewegung starten";

    anzeigenAktualisieren();
}


// Setzt alle Winkel zurück.
function szeneZuruecksetzen() {

    perlenWinkel = 0;
    torusWinkel = 0;
    automatikAktiv = false;
    torusDrehungAktiv = true;
    letzterZeitpunkt = 0;

    automatikButton.setAttribute(
        "aria-pressed",
        "false"
    );

    automatikButton.textContent =
        "Bewegung starten";

    torusButton.setAttribute(
        "aria-pressed",
        "true"
    );

    torusButton.textContent =
        "Torusdrehung anhalten";

    torusAnzeige.textContent =
        "Torusdrehung ist eingeschaltet.";

    anzeigenAktualisieren();
    szeneZeichnen();
}


// Einen Schritt über den Button ausführen.
schrittButton.addEventListener(
    "click",
    function () {
        bewegungWeiter(0.12);
    }
);


// Automatische Bewegung ein- oder ausschalten.
automatikButton.addEventListener(
    "click",
    automatikUmschalten
);


// Torusdrehung ein- oder ausschalten.
torusButton.addEventListener(
    "click",
    torusDrehungUmschalten
);


// Szene zurücksetzen.
zuruecksetzenButton.addEventListener(
    "click",
    szeneZuruecksetzen
);


// Tastatureingaben verarbeiten.
document.addEventListener(
    "keydown",
    function (event) {

        const ziel = event.target;

        if (
            ziel instanceof HTMLElement
            && (
                ziel.isContentEditable
                || [
                    "INPUT",
                    "TEXTAREA",
                    "SELECT"
                ].includes(ziel.tagName)
            )
        ) {
            return;
        }

        const taste =
            event.key.toLowerCase();

        if (event.repeat) {
            return;
        }

        if (taste === "k") {
            bewegungWeiter(0.12);
        }

        if (taste === "a") {
            automatikUmschalten();
        }

        if (taste === "t") {
            torusDrehungUmschalten();
        }

        if (taste === "r") {
            szeneZuruecksetzen();
        }
    }
);


// Die automatische Animation wird mit
// requestAnimationFrame ausgeführt.
function animieren(zeitpunkt) {

    if (automatikAktiv) {

        if (letzterZeitpunkt === 0) {
            letzterZeitpunkt = zeitpunkt;
        }

        const vergangeneZeit =
            Math.min(
                (zeitpunkt - letzterZeitpunkt)
                    / 1000,
                0.05
            );

        // Die Geschwindigkeit bleibt dadurch
        // unabhängig von der Bildwiederholrate.
        bewegungWeiter(
            vergangeneZeit * 0.85
        );

        letzterZeitpunkt = zeitpunkt;

    } else {
        letzterZeitpunkt = 0;
    }

    requestAnimationFrame(animieren);
}


requestAnimationFrame(animieren);

// --------------------------------------------------
// END EA6_INTERAKTION
// --------------------------------------------------


// --------------------------------------------------
// START EA6_ENTSTEHUNGSPROZESS
// --------------------------------------------------

const fortschrittsbilder = [

    {
        datei:
            "fortschritt/schritt_01.png",

        alt:
            "Erster Zwischenstand mit Gitterebene und Torus",

        beschreibung:
            "Im ersten Schritt habe ich die Gitterebene "
            + "und den Torus aufgebaut."
    },

    {
        datei:
            "fortschritt/schritt_02.png",

        alt:
            "Vier farbige Perlen in der WebGL-Szene",

        beschreibung:
            "Danach kamen die vier unterschiedlich "
            + "gefärbten Erinnerungsperlen hinzu."
    },

    {
        datei:
            "fortschritt/schritt_03.png",

        alt:
            "Fertige Animation der vier Perlen und des Torus",

        beschreibung:
            "Die Perlen bewegen sich auf einer gemeinsamen "
            + "Kreisbahn durch den gleichzeitig gedrehten Torus."
    },

    {
        datei:
            "fortschritt/schritt_04.png",

        alt:
            "Fertige Webseite mit geöffneter Entwicklerkonsole",

        beschreibung:
            "Zum Abschluss habe ich die Buttons, Tasten und "
            + "Animation getestet. In der Entwicklerkonsole "
            + "sind keine Fehlermeldungen zu sehen."
    }

];


const schrittBild =
    document.getElementById("schrittBild");

const schrittZaehler =
    document.getElementById("schrittZaehler");

const schrittBeschreibung =
    document.getElementById(
        "schrittBeschreibung"
    );

const schrittZurueck =
    document.getElementById(
        "schrittZurueck"
    );

const schrittWeiter =
    document.getElementById(
        "schrittWeiter"
    );

const schrittpunkte =
    document.getElementById(
        "schrittpunkte"
    );

let aktuellerSchritt = 0;


// Erstellt die Punkte unter dem Bild.
function schrittpunkteErstellen() {

    schrittpunkte.innerHTML = "";

    fortschrittsbilder.forEach(
        function (_, index) {

            const punkt =
                document.createElement("button");

            punkt.type = "button";
            punkt.className = "schrittpunkt";

            punkt.setAttribute(
                "aria-label",
                "Bild "
                    + (index + 1)
                    + " anzeigen"
            );

            punkt.addEventListener(
                "click",
                function () {
                    aktuellerSchritt = index;
                    schrittAnzeigen();
                }
            );

            schrittpunkte.appendChild(punkt);
        }
    );
}


// Zeigt das ausgewählte Fortschrittsbild.
function schrittAnzeigen() {

    const schritt =
        fortschrittsbilder[
            aktuellerSchritt
        ];

    schrittBild.src = schritt.datei;
    schrittBild.alt = schritt.alt;

    schrittZaehler.textContent =
        "Bild "
        + (aktuellerSchritt + 1)
        + " von "
        + fortschrittsbilder.length;

    schrittBeschreibung.textContent =
        schritt.beschreibung;

    schrittZurueck.disabled =
        aktuellerSchritt === 0;

    schrittWeiter.disabled =
        aktuellerSchritt
        === fortschrittsbilder.length - 1;


    const punkte =
        schrittpunkte.querySelectorAll(
            ".schrittpunkt"
        );

    punkte.forEach(
        function (punkt, index) {

            if (index === aktuellerSchritt) {
                punkt.setAttribute(
                    "aria-current",
                    "true"
                );
            } else {
                punkt.removeAttribute(
                    "aria-current"
                );
            }
        }
    );
}


schrittZurueck.addEventListener(
    "click",
    function () {

        if (aktuellerSchritt > 0) {
            aktuellerSchritt--;
            schrittAnzeigen();
        }
    }
);


schrittWeiter.addEventListener(
    "click",
    function () {

        if (
            aktuellerSchritt
            < fortschrittsbilder.length - 1
        ) {
            aktuellerSchritt++;
            schrittAnzeigen();
        }
    }
);


schrittpunkteErstellen();
schrittAnzeigen();

// --------------------------------------------------
// END EA6_ENTSTEHUNGSPROZESS
// --------------------------------------------------


// --------------------------------------------------
// 14. ANWENDUNG STARTEN
// --------------------------------------------------

anzeigenAktualisieren();
szeneZeichnen();

statusanzeige.textContent =
    "Die vier Erinnerungsperlen und der Meeresring "
    + "wurden erfolgreich mit WebGL geladen.";

console.log(
    "EA 6 wurde erfolgreich gestartet."
);

console.log(
    "Vier Perlen bewegen sich auf einer gemeinsamen Kreisbahn."
);

console.log(
    "Die Torusdrehung ist als Erweiterung aktiviert."
);