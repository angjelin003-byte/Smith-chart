package com.smithchart.calculator.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.smithchart.calculator.R
import kotlin.math.*

data class ComplexNumber(val r: Double, val i: Double) {
    operator fun plus(other: ComplexNumber) = ComplexNumber(r + other.r, i + other.i)
    operator fun minus(other: ComplexNumber) = ComplexNumber(r - other.r, i - other.i)
    operator fun times(other: ComplexNumber) = ComplexNumber(r * other.r - i * other.i, r * other.i + i * other.r)
    operator fun div(other: ComplexNumber): ComplexNumber {
        val d = other.r * other.r + other.i * other.i
        return if (d == 0.0) ComplexNumber(0.0, 0.0) else ComplexNumber(
            (r * other.r + i * other.i) / d,
            (i * other.r - r * other.i) / d
        )
    }
    fun reciprocal(): ComplexNumber {
        val d = r * r + i * i
        return if (d == 0.0) ComplexNumber(0.0, 0.0) else ComplexNumber(r / d, -i / d)
    }
    fun mag(): Double = sqrt(r * r + i * i)
    fun phaseDeg(): Double = atan2(i, r) * 180.0 / PI
}

enum class StubTermination { SHORT, OPEN }
enum class MatchingMode { TRANSMISSION_LINE_STUB, SERIES_LC }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SmithChartScreen(
    isDarkTheme: Boolean = true,
    onToggleTheme: () -> Unit = {}
) {
    // RF System Parameters
    var frequency by remember { mutableStateOf(1.0e9) }       // 1 GHz
    var z0 by remember { mutableStateOf(50.0) }               // 50 ohms
    var maxRangeR by remember { mutableStateOf(250.0) }       // Max R slider range
    var maxRangeX by remember { mutableStateOf(250.0) }       // Max X slider range

    // Load Impedance
    var loadR by remember { mutableStateOf(25.0) }
    var loadX by remember { mutableStateOf(50.0) }

    // Matching Architecture Mode
    var matchingMode by remember { mutableStateOf(MatchingMode.TRANSMISSION_LINE_STUB) }

    // Transmission line & Stub parameters
    var tLineLen by remember { mutableStateOf(0.12) }         // in wavelengths (lambda), 0 to 0.5
    var stubLen by remember { mutableStateOf(0.15) }          // in wavelengths (lambda), 0 to 0.5
    var stubType by remember { mutableStateOf(StubTermination.SHORT) }
    var enableStub by remember { mutableStateOf(true) }
    var enableTLine by remember { mutableStateOf(true) }

    // Series L/C parameters
    var seriesL by remember { mutableStateOf(0.0) }           // in nH
    var seriesC by remember { mutableStateOf(0.0) }           // in pF
    var shuntC by remember { mutableStateOf(0.0) }            // in pF
    var shuntL by remember { mutableStateOf(0.0) }            // in nH

    // UI state
    var showOptionsMenu by remember { mutableStateOf(false) }
    var showVswrCircle by remember { mutableStateOf(true) }
    var showDirectInputDialog by remember { mutableStateOf(false) }

    // Compute normalized load
    val zNormLoad = ComplexNumber(loadR / z0, loadX / z0)
    val gammaLoadDenom = (zNormLoad.r + 1.0) * (zNormLoad.r + 1.0) + zNormLoad.i * zNormLoad.i
    val gammaLoad = if (gammaLoadDenom == 0.0) ComplexNumber(0.0, 0.0) else ComplexNumber(
        ((zNormLoad.r - 1.0) * (zNormLoad.r + 1.0) + zNormLoad.i * zNormLoad.i) / gammaLoadDenom,
        (2.0 * zNormLoad.i) / gammaLoadDenom
    )

    // Intermediate and Final Points for Trajectory
    val intermediateGamma: ComplexNumber
    val finalZ: ComplexNumber

    val omega = 2.0 * PI * frequency

    if (matchingMode == MatchingMode.TRANSMISSION_LINE_STUB) {
        // Step 1: Rotate clockwise along transmission line: beta * d = 2*pi * d
        val thetaRot = if (enableTLine) -4.0 * PI * tLineLen else 0.0
        val cosT = cos(thetaRot)
        val sinT = sin(thetaRot)
        intermediateGamma = ComplexNumber(
            gammaLoad.r * cosT - gammaLoad.i * sinT,
            gammaLoad.r * sinT + gammaLoad.i * cosT
        )

        // Line input normalized impedance
        val zLineNorm = ComplexNumber(1.0 + intermediateGamma.r, intermediateGamma.i) /
                ComplexNumber(1.0 - intermediateGamma.r, -intermediateGamma.i)

        // Line input normalized admittance
        val yLineNorm = zLineNorm.reciprocal()

        // Step 2: Add Shunt Stub admittance
        val bStub = if (enableStub && stubLen > 0.0001) {
            val betaL = 2.0 * PI * stubLen
            if (stubType == StubTermination.SHORT) {
                val tanVal = tan(betaL)
                if (abs(tanVal) < 1e-4) -100.0 else -1.0 / tanVal
            } else {
                tan(betaL)
            }
        } else 0.0

        val yFinalNorm = ComplexNumber(yLineNorm.r, yLineNorm.i + bStub)
        finalZ = yFinalNorm.reciprocal()
    } else {
        // Series L/C & Shunt L/C Mode
        var curZ = ComplexNumber(loadR, loadX)

        if (seriesL > 0.0) {
            val xL = omega * (seriesL * 1e-9)
            curZ = ComplexNumber(curZ.r, curZ.i + xL)
        }
        if (seriesC > 0.0) {
            val xC = -1.0 / (omega * (seriesC * 1e-12))
            curZ = ComplexNumber(curZ.r, curZ.i + xC)
        }

        var curY = curZ.reciprocal()
        if (shuntC > 0.0) {
            val bC = omega * (shuntC * 1e-12)
            curY = ComplexNumber(curY.r, curY.i + bC)
        }
        if (shuntL > 0.0) {
            val bL = -1.0 / (omega * (shuntL * 1e-9))
            curY = ComplexNumber(curY.r, curY.i + bL)
        }

        val zAfterShunt = curY.reciprocal()
        finalZ = ComplexNumber(zAfterShunt.r / z0, zAfterShunt.i / z0)
        intermediateGamma = gammaLoad
    }

    // Final Reflection Coefficient Gamma
    val finalDenom = (finalZ.r + 1.0) * (finalZ.r + 1.0) + finalZ.i * finalZ.i
    val finalGamma = if (finalDenom == 0.0) ComplexNumber(0.0, 0.0) else ComplexNumber(
        ((finalZ.r - 1.0) * (finalZ.r + 1.0) + finalZ.i * finalZ.i) / finalDenom,
        (2.0 * finalZ.i) / finalDenom
    )

    val finalGammaMag = finalGamma.mag().coerceIn(0.0, 1.0)
    val finalGammaPhase = finalGamma.phaseDeg()

    // RF Metrics
    val vswr = if (finalGammaMag >= 0.999) 99.9 else (1.0 + finalGammaMag) / (1.0 - finalGammaMag)
    val returnLoss = if (finalGammaMag <= 1e-4) 60.0 else (-20.0 * log10(finalGammaMag)).coerceAtMost(60.0)
    val mismatchLoss = if (finalGammaMag >= 0.999) 99.9 else (-10.0 * log10(1.0 - finalGammaMag * finalGammaMag)).coerceAtLeast(0.0)

    val actualZ = ComplexNumber(finalZ.r * z0, finalZ.i * z0)

    // Auto-match function for Single Stub
    val autoMatchStub = {
        val gammaM = gammaLoad.mag()

        if (gammaM > 0.005 && gammaM < 0.99) {
            val thetaL = atan2(gammaLoad.i, gammaLoad.r)
            val phi = acos(gammaM)
            var dOpt = (thetaL + phi) / (4.0 * PI)
            while (dOpt < 0) dOpt += 0.5
            while (dOpt >= 0.5) dOpt -= 0.5

            // Compute admittance at distance dOpt
            val rot = -4.0 * PI * dOpt
            val gRot = ComplexNumber(
                gammaLoad.r * cos(rot) - gammaLoad.i * sin(rot),
                gammaLoad.r * sin(rot) + gammaLoad.i * cos(rot)
            )
            val zRot = ComplexNumber(1.0 + gRot.r, gRot.i) / ComplexNumber(1.0 - gRot.r, -gRot.i)
            val yRot = zRot.reciprocal()
            val reqB = -yRot.i

            val lOpt = if (stubType == StubTermination.SHORT) {
                var angle = atan2(-1.0, reqB)
                if (angle < 0) angle += PI
                (angle / (2.0 * PI)).coerceIn(0.01, 0.49)
            } else {
                var angle = atan(reqB)
                if (angle < 0) angle += PI
                (angle / (2.0 * PI)).coerceIn(0.01, 0.49)
            }

            tLineLen = dOpt
            stubLen = lOpt
            enableTLine = true
            enableStub = true
            matchingMode = MatchingMode.TRANSMISSION_LINE_STUB
        }
    }

    val scrollState = rememberScrollState()

    // Color theme definitions
    val bgMain = if (isDarkTheme) Color(0xFF0F172A) else Color(0xFFF1F5F9)
    val bgCard = if (isDarkTheme) Color(0xFF1E293B) else Color(0xFFFFFFFF)
    val textPrimary = if (isDarkTheme) Color(0xFFF8FAFC) else Color(0xFF0F172A)
    val textSecondary = if (isDarkTheme) Color(0xFF94A3B8) else Color(0xFF64748B)
    val borderCol = if (isDarkTheme) Color(0xFF334155) else Color(0xFFE2E8F0)
    val chartBg = if (isDarkTheme) Color(0xFF090D16) else Color(0xFFFAFAFA)
    val chartGrid = if (isDarkTheme) Color(0xFF1E293B) else Color(0xFFCBD5E1)
    val primaryCyan = if (isDarkTheme) Color(0xFF06B6D4) else Color(0xFF0284C7)

    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = {
                    Box(
                        modifier = Modifier
                            .padding(start = 12.dp, end = 4.dp)
                            .size(34.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .border(1.dp, borderCol, RoundedCornerShape(8.dp))
                    ) {
                        Image(
                            painter = painterResource(id = R.drawable.ic_launcher),
                            contentDescription = "App Icon",
                            modifier = Modifier.fillMaxSize()
                        )
                    }
                },
                title = {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("Smith Chart Studio", fontWeight = FontWeight.Bold, fontSize = 17.sp)
                            Spacer(modifier = Modifier.width(6.dp))
                            Surface(
                                color = primaryCyan.copy(alpha = 0.2f),
                                shape = RoundedCornerShape(4.dp)
                            ) {
                                Text(
                                    "RF Pro",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = primaryCyan,
                                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                                )
                            }
                        }
                        Text("Interactive Real-Time Impedance Calculator", fontSize = 11.sp, color = textSecondary)
                    }
                },
                actions = {
                    IconButton(onClick = {
                        loadR = 50.0
                        loadX = 0.0
                        z0 = 50.0
                        frequency = 1.0e9
                        tLineLen = 0.0
                        stubLen = 0.0
                        seriesL = 0.0
                        seriesC = 0.0
                        shuntC = 0.0
                        shuntL = 0.0
                    }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Reset All", tint = textPrimary)
                    }
                    IconButton(onClick = { showOptionsMenu = true }) {
                        Icon(Icons.Default.MoreVert, contentDescription = "Options Menu", tint = textPrimary)
                    }
                    DropdownMenu(
                        expanded = showOptionsMenu,
                        onDismissRequest = { showOptionsMenu = false }
                    ) {
                        DropdownMenuItem(
                            text = {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        if (isDarkTheme) Icons.Default.LightMode else Icons.Default.DarkMode,
                                        contentDescription = null,
                                        modifier = Modifier.size(18.dp)
                                    )
                                    Spacer(modifier = Modifier.width(10.dp))
                                    Text(if (isDarkTheme) "Switch to Light Mode" else "Switch to Dark Mode")
                                }
                            },
                            onClick = {
                                showOptionsMenu = false
                                onToggleTheme()
                            }
                        )
                        Divider()
                        DropdownMenuItem(
                            text = {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.AutoMode, contentDescription = null, modifier = Modifier.size(18.dp), tint = primaryCyan)
                                    Spacer(modifier = Modifier.width(10.dp))
                                    Text("Auto-Match Stub to 50Ω")
                                }
                            },
                            onClick = {
                                showOptionsMenu = false
                                autoMatchStub()
                            }
                        )
                        DropdownMenuItem(
                            text = {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.Tune, contentDescription = null, modifier = Modifier.size(18.dp))
                                    Spacer(modifier = Modifier.width(10.dp))
                                    Text(if (showVswrCircle) "Hide VSWR 1.5 Circle" else "Show VSWR 1.5 Circle")
                                }
                            },
                            onClick = {
                                showOptionsMenu = false
                                showVswrCircle = !showVswrCircle
                            }
                        )
                        Divider()
                        DropdownMenuItem(
                            text = { Text("Preset: 50Ω Matched Load") },
                            onClick = {
                                showOptionsMenu = false
                                loadR = 50.0; loadX = 0.0
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("Preset: 75Ω Video Cable") },
                            onClick = {
                                showOptionsMenu = false
                                loadR = 75.0; loadX = 0.0
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("Preset: 25 + j50Ω (Inductive)") },
                            onClick = {
                                showOptionsMenu = false
                                loadR = 25.0; loadX = 50.0
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("Preset: 50 - j75Ω (Capacitive)") },
                            onClick = {
                                showOptionsMenu = false
                                loadR = 50.0; loadX = -75.0
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("Preset: 73 + j42Ω (Dipole)") },
                            onClick = {
                                showOptionsMenu = false
                                loadR = 73.0; loadX = 42.0
                            }
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = bgCard,
                    titleContentColor = textPrimary,
                    actionIconContentColor = textPrimary
                )
            )
        },
        containerColor = bgMain
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Static Smith Chart Display Card (Stays fixed when scrolling the page)
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 6.dp)
            ) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = bgCard),
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, borderCol, RoundedCornerShape(8.dp)),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                "Smith Chart Complex Impedance Plane",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = textSecondary
                            )
                            Surface(
                                color = if (vswr <= 1.5) Color(0xFF10B981).copy(alpha = 0.2f) else if (vswr <= 2.0) Color(0xFFF59E0B).copy(alpha = 0.2f) else Color(0xFFEF4444).copy(alpha = 0.2f),
                                shape = RoundedCornerShape(6.dp)
                            ) {
                                Text(
                                    text = if (vswr <= 1.2) "Perfect Match" else if (vswr <= 1.5) "Good Match" else if (vswr <= 2.0) "Acceptable" else "Mismatched",
                                    color = if (vswr <= 1.5) Color(0xFF10B981) else if (vswr <= 2.0) Color(0xFFF59E0B) else Color(0xFFEF4444),
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(6.dp))

                        // Enlarged Smith Chart Interactive Canvas
                        BoxWithConstraints(
                            modifier = Modifier.fillMaxWidth(),
                            contentAlignment = Alignment.Center
                        ) {
                            val chartDim = if (maxWidth < 335.dp) maxWidth else 335.dp
                            Box(
                                modifier = Modifier
                                    .size(chartDim)
                                    .clip(CircleShape)
                                    .pointerInput(z0, maxRangeR, maxRangeX) {
                                        detectTapGestures { offset ->
                                            val sizePx = size.width.toFloat()
                                            val cx = sizePx / 2f
                                            val cy = sizePx / 2f
                                            val radius = sizePx / 2f - 8f

                                            val dx = (offset.x - cx) / radius
                                            val dy = (cy - offset.y) / radius

                                            val gammaSq = dx * dx + dy * dy
                                            if (gammaSq <= 1.0) {
                                                val denom = (1.0 - dx) * (1.0 - dx) + dy * dy
                                                if (denom > 1e-4) {
                                                    val rNorm = (1.0 - gammaSq) / denom
                                                    val xNorm = (2.0 * dy) / denom
                                                    loadR = (rNorm * z0).coerceIn(0.1, maxRangeR)
                                                    loadX = (xNorm * z0).coerceIn(-maxRangeX, maxRangeX)
                                                }
                                            }
                                        }
                                    }
                            ) {
                                Canvas(modifier = Modifier.fillMaxSize()) {
                                    val cx = size.width / 2f
                                    val cy = size.height / 2f
                                    val radius = size.width / 2f - 8f

                            // Background Circle
                            drawCircle(color = chartBg, radius = radius, center = Offset(cx, cy))
                            drawCircle(color = chartGrid, radius = radius, center = Offset(cx, cy), style = Stroke(width = 2.5f))

                            // Dense Resistance Circles (r = 0.1, 0.2, 0.33, 0.5, 0.7, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0, 10.0)
                            val rMajor = setOf(0.2, 0.5, 1.0, 2.0, 5.0)
                            val rList = listOf(0.1, 0.2, 0.33, 0.5, 0.7, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0, 10.0)
                            rList.forEach { r ->
                                val circleR = radius / (1.0 + r).toFloat()
                                val circleCx = cx + radius * (r / (1.0 + r)).toFloat()
                                val isNormUnity = r == 1.0
                                val isMajor = r in rMajor
                                drawCircle(
                                    color = when {
                                        isNormUnity -> primaryCyan.copy(alpha = 0.6f)
                                        isMajor -> chartGrid.copy(alpha = 0.75f)
                                        else -> chartGrid.copy(alpha = 0.35f)
                                    },
                                    radius = circleR,
                                    center = Offset(circleCx, cy),
                                    style = Stroke(
                                        width = if (isNormUnity) 1.8f else if (isMajor) 1.2f else 0.8f
                                    )
                                )
                            }

                            // Dense Reactance Arcs (x = +/- 0.2, 0.4, 0.6, 1.0, 1.5, 2.0, 3.0, 5.0)
                            val xMajor = setOf(0.5, 1.0, 2.0)
                            val xList = listOf(
                                0.2, 0.4, 0.6, 1.0, 1.5, 2.0, 3.0, 5.0,
                                -0.2, -0.4, -0.6, -1.0, -1.5, -2.0, -3.0, -5.0
                            )
                            xList.forEach { x ->
                                val arcR = radius / abs(x).toFloat()
                                val arcCy = cy - (radius / x).toFloat()
                                val isMajor = abs(x) in xMajor || abs(x) == 1.0
                                drawCircle(
                                    color = if (isMajor) chartGrid.copy(alpha = 0.5f) else chartGrid.copy(alpha = 0.28f),
                                    radius = arcR,
                                    center = Offset(cx + radius, arcCy),
                                    style = Stroke(width = if (isMajor) 1f else 0.7f)
                                )
                            }

                            // Real Axis Horizontal Line
                            drawLine(
                                color = chartGrid,
                                start = Offset(cx - radius, cy),
                                end = Offset(cx + radius, cy),
                                strokeWidth = 2f
                            )

                            // Center Crosshair (Matched 50 Ohm point)
                            drawLine(
                                color = primaryCyan,
                                start = Offset(cx - 8f, cy),
                                end = Offset(cx + 8f, cy),
                                strokeWidth = 2f
                            )
                            drawLine(
                                color = primaryCyan,
                                start = Offset(cx, cy - 8f),
                                end = Offset(cx, cy + 8f),
                                strokeWidth = 2f
                            )

                            // VSWR = 1.5 Target Circle
                            if (showVswrCircle) {
                                val targetVswr = 1.5
                                val targetGamma = ((targetVswr - 1.0) / (targetVswr + 1.0)).toFloat()
                                val vswrRadius = radius * targetGamma
                                drawCircle(
                                    color = Color(0xFF10B981).copy(alpha = 0.7f),
                                    radius = vswrRadius,
                                    center = Offset(cx, cy),
                                    style = Stroke(
                                        width = 2f,
                                        pathEffect = PathEffect.dashPathEffect(floatArrayOf(8f, 6f), 0f)
                                    )
                                )
                            }

                            // 1. Initial Load Point (Z_L)
                            val pxLoad = cx + (gammaLoad.r * radius).toFloat()
                            val pyLoad = cy - (gammaLoad.i * radius).toFloat()

                            // 2. Intermediate Point after Transmission Line
                            val pxInter = cx + (intermediateGamma.r * radius).toFloat()
                            val pyInter = cy - (intermediateGamma.i * radius).toFloat()

                            // Draw Transmission Line rotation arc if active
                            if (matchingMode == MatchingMode.TRANSMISSION_LINE_STUB && enableTLine && tLineLen > 0.001) {
                                val gammaR = gammaLoad.mag().toFloat() * radius
                                drawCircle(
                                    color = primaryCyan.copy(alpha = 0.35f),
                                    radius = gammaR,
                                    center = Offset(cx, cy),
                                    style = Stroke(
                                        width = 2.5f,
                                        pathEffect = PathEffect.dashPathEffect(floatArrayOf(6f, 4f), 0f)
                                    )
                                )
                                drawLine(
                                    color = primaryCyan.copy(alpha = 0.6f),
                                    start = Offset(pxLoad, pyLoad),
                                    end = Offset(pxInter, pyInter),
                                    strokeWidth = 2f
                                )
                                // Intermediate marker
                                drawCircle(color = Color(0xFF3B82F6), radius = 6f, center = Offset(pxInter, pyInter))
                            }

                            // 3. Final Point after Stub / Matching
                            val pxFinal = cx + (finalGamma.r * radius).toFloat()
                            val pyFinal = cy - (finalGamma.i * radius).toFloat()

                            if (matchingMode == MatchingMode.TRANSMISSION_LINE_STUB && enableStub) {
                                drawLine(
                                    color = Color(0xFF10B981).copy(alpha = 0.7f),
                                    start = Offset(pxInter, pyInter),
                                    end = Offset(pxFinal, pyFinal),
                                    strokeWidth = 2.5f
                                )
                            }

                            // Load Point Marker (Amber)
                            drawCircle(color = Color(0xFFF59E0B), radius = 7f, center = Offset(pxLoad, pyLoad))
                            drawCircle(color = Color.White, radius = 3.5f, center = Offset(pxLoad, pyLoad))

                            // Final Matched Marker (Emerald/Cyan)
                            drawCircle(
                                color = if (vswr <= 1.5) Color(0xFF10B981) else primaryCyan,
                                radius = 9f,
                                center = Offset(pxFinal, pyFinal)
                            )
                            drawCircle(color = Color.White, radius = 5f, center = Offset(pxFinal, pyFinal))
                        }
                    }
                }

                    Spacer(modifier = Modifier.height(6.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(color = Color(0xFFF59E0B), shape = CircleShape, modifier = Modifier.size(8.dp)) {}
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Load ZL", fontSize = 11.sp, color = textSecondary)

                        Spacer(modifier = Modifier.width(16.dp))
                        Surface(color = Color(0xFF3B82F6), shape = CircleShape, modifier = Modifier.size(8.dp)) {}
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("T-Line", fontSize = 11.sp, color = textSecondary)

                        Spacer(modifier = Modifier.width(16.dp))
                        Surface(color = Color(0xFF10B981), shape = CircleShape, modifier = Modifier.size(8.dp)) {}
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Matched Zin", fontSize = 11.sp, color = textSecondary)
                    }
                }
            }
        }

        // Scrollable Content (slides underneath the static chart panel)
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .verticalScroll(scrollState)
                .padding(horizontal = 16.dp)
                .padding(bottom = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // VSWR & RF Performance Metrics Card
            Card(
                colors = CardDefaults.cardColors(containerColor = bgCard),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, borderCol, RoundedCornerShape(8.dp)),
                shape = RoundedCornerShape(8.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        "VSWR & RF Performance Metrics",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = textSecondary
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        MetricBox(
                            modifier = Modifier.weight(1f),
                            label = "VSWR",
                            value = if (vswr > 50) "> 50:1" else String.format("%.2f:1", vswr),
                            valueColor = if (vswr <= 1.5) Color(0xFF10B981) else if (vswr <= 2.0) Color(0xFFF59E0B) else Color(0xFFEF4444),
                            bg = bgMain
                        )
                        MetricBox(
                            modifier = Modifier.weight(1f),
                            label = "Return Loss",
                            value = String.format("%.1f dB", returnLoss),
                            valueColor = primaryCyan,
                            bg = bgMain
                        )
                        MetricBox(
                            modifier = Modifier.weight(1f),
                            label = "|Γ| Magnitude",
                            value = String.format("%.3f", finalGammaMag),
                            valueColor = if (finalGammaMag < 0.2) Color(0xFF10B981) else Color(0xFFF59E0B),
                            bg = bgMain
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        MetricBox(
                            modifier = Modifier.weight(1f),
                            label = "Γ Phase Angle",
                            value = String.format("%.1f°", finalGammaPhase),
                            valueColor = textPrimary,
                            bg = bgMain
                        )
                        MetricBox(
                            modifier = Modifier.weight(1f),
                            label = "Input Z (R+jX)",
                            value = "${String.format("%.1f", actualZ.r)}${if (actualZ.i >= 0) "+" else ""}${String.format("%.1f", actualZ.i)}j Ω",
                            valueColor = textPrimary,
                            bg = bgMain
                        )
                        MetricBox(
                            modifier = Modifier.weight(1f),
                            label = "Mismatch Loss",
                            value = String.format("%.2f dB", mismatchLoss),
                            valueColor = textSecondary,
                            bg = bgMain
                        )
                    }
                }
            }

            // Real-Time Load R & X Sliders & Controls Card
            Card(
                colors = CardDefaults.cardColors(containerColor = bgCard),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, borderCol, RoundedCornerShape(8.dp)),
                shape = RoundedCornerShape(8.dp)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            "Load Impedance & Sliders",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = textSecondary
                        )
                        Row {
                            TextButton(onClick = { showDirectInputDialog = true }) {
                                Icon(Icons.Default.Edit, contentDescription = "Edit Values", modifier = Modifier.size(14.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Edit Exact", fontSize = 12.sp)
                            }
                            TextButton(onClick = {
                                maxRangeR = if (maxRangeR == 250.0) 500.0 else 250.0
                                maxRangeX = if (maxRangeX == 250.0) 500.0 else 250.0
                            }) {
                                Text("Range: ${maxRangeR.toInt()}Ω", fontSize = 12.sp)
                            }
                        }
                    }

                    // Load Resistance Slider
                    CustomSliderRow(
                        label = "Load Resistance (R_L)",
                        value = loadR,
                        range = 0.0..maxRangeR,
                        unit = "Ω",
                        accentColor = Color(0xFFF59E0B),
                        onValueChange = { loadR = it },
                        onStep = { loadR = (loadR + it).coerceIn(0.0, maxRangeR) }
                    )

                    // Load Reactance Slider
                    CustomSliderRow(
                        label = "Load Reactance (X_L)",
                        value = loadX,
                        range = -maxRangeX..maxRangeX,
                        unit = "jΩ",
                        accentColor = Color(0xFF3B82F6),
                        onValueChange = { loadX = it },
                        onStep = { loadX = (loadX + it).coerceIn(-maxRangeX, maxRangeX) }
                    )

                    // Characteristic Impedance Z0 & Frequency Sliders
                    CustomSliderRow(
                        label = "Characteristic Impedance (Z₀)",
                        value = z0,
                        range = 20.0..200.0,
                        unit = "Ω",
                        accentColor = primaryCyan,
                        onValueChange = { z0 = it },
                        onStep = { z0 = (z0 + it).coerceIn(20.0, 200.0) }
                    )

                    CustomSliderRow(
                        label = "Operating Frequency (f)",
                        value = frequency / 1e9,
                        range = 0.1..10.0,
                        unit = "GHz",
                        accentColor = textPrimary,
                        onValueChange = { frequency = it * 1e9 },
                        onStep = { frequency = (frequency + it * 1e9).coerceIn(0.1e9, 10.0e9) }
                    )

                    // Quick Preset Chips
                    Text("Quick Presets", fontSize = 11.sp, color = textSecondary, fontWeight = FontWeight.SemiBold)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        PresetChip("50Ω Matched", isSelected = loadR == 50.0 && loadX == 0.0) { loadR = 50.0; loadX = 0.0 }
                        PresetChip("75Ω Cable", isSelected = loadR == 75.0 && loadX == 0.0) { loadR = 75.0; loadX = 0.0 }
                        PresetChip("25+j50Ω", isSelected = loadR == 25.0 && loadX == 50.0) { loadR = 25.0; loadX = 50.0 }
                        PresetChip("73+j42Ω", isSelected = loadR == 73.0 && loadX == 42.0) { loadR = 73.0; loadX = 42.0 }
                    }
                }
            }

            // Series L/C & Transmission Line Stub Matching Card
            Card(
                colors = CardDefaults.cardColors(containerColor = bgCard),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, borderCol, RoundedCornerShape(8.dp)),
                shape = RoundedCornerShape(8.dp)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            "Impedance Matching Network",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = textSecondary
                        )
                        Button(
                            onClick = { autoMatchStub() },
                            colors = ButtonDefaults.buttonColors(containerColor = primaryCyan),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Icon(Icons.Default.AutoMode, contentDescription = null, modifier = Modifier.size(14.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Auto Match Stub", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }

                    // Matching Mode Tab Selector
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(bgMain, RoundedCornerShape(10.dp))
                            .padding(3.dp)
                    ) {
                        TabButton(
                            modifier = Modifier.weight(1f),
                            title = "Transmission Line Stub",
                            isSelected = matchingMode == MatchingMode.TRANSMISSION_LINE_STUB,
                            primaryColor = primaryCyan,
                            textSecondary = textSecondary
                        ) { matchingMode = MatchingMode.TRANSMISSION_LINE_STUB }

                        TabButton(
                            modifier = Modifier.weight(1f),
                            title = "L-C Reactive Network",
                            isSelected = matchingMode == MatchingMode.SERIES_LC,
                            primaryColor = primaryCyan,
                            textSecondary = textSecondary
                        ) { matchingMode = MatchingMode.SERIES_LC }
                    }

                    if (matchingMode == MatchingMode.TRANSMISSION_LINE_STUB) {
                        // Transmission Line Distance d
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Switch(
                                    checked = enableTLine,
                                    onCheckedChange = { enableTLine = it }
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Line Section (d)", fontSize = 12.sp, fontWeight = FontWeight.Medium)
                            }
                            Text(
                                "${String.format("%.3f", tLineLen)} λ (${String.format("%.1f", tLineLen * 360)}°)",
                                fontSize = 12.sp,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                color = primaryCyan
                            )
                        }
                        if (enableTLine) {
                            Slider(
                                value = tLineLen.toFloat(),
                                onValueChange = { tLineLen = it.toDouble() },
                                valueRange = 0.0f..0.50f
                            )
                        }

                        Divider(color = borderCol)

                        // Stub Configuration
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Switch(
                                    checked = enableStub,
                                    onCheckedChange = { enableStub = it }
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Tuning Stub (l)", fontSize = 12.sp, fontWeight = FontWeight.Medium)
                            }

                            Row(verticalAlignment = Alignment.CenterVertically) {
                                FilterChip(
                                    selected = stubType == StubTermination.SHORT,
                                    onClick = { stubType = StubTermination.SHORT },
                                    label = { Text("Short", fontSize = 11.sp) }
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                FilterChip(
                                    selected = stubType == StubTermination.OPEN,
                                    onClick = { stubType = StubTermination.OPEN },
                                    label = { Text("Open", fontSize = 11.sp) }
                                )
                            }
                        }

                        if (enableStub) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Stub Length", fontSize = 11.sp, color = textSecondary)
                                Text(
                                    "${String.format("%.3f", stubLen)} λ (${String.format("%.1f", stubLen * 360)}°)",
                                    fontSize = 12.sp,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF10B981)
                                )
                            }
                            Slider(
                                value = stubLen.toFloat(),
                                onValueChange = { stubLen = it.toDouble() },
                                valueRange = 0.0f..0.50f
                            )
                        }
                    } else {
                        // Series & Shunt L/C Network
                        CustomSliderRow(
                            label = "Series Inductor (L_series)",
                            value = seriesL,
                            range = 0.0..50.0,
                            unit = "nH",
                            accentColor = primaryCyan,
                            onValueChange = { seriesL = it },
                            onStep = { seriesL = (seriesL + it).coerceIn(0.0, 50.0) }
                        )

                        CustomSliderRow(
                            label = "Series Capacitor (C_series)",
                            value = seriesC,
                            range = 0.0..50.0,
                            unit = "pF",
                            accentColor = Color(0xFF3B82F6),
                            onValueChange = { seriesC = it },
                            onStep = { seriesC = (seriesC + it).coerceIn(0.0, 50.0) }
                        )

                        CustomSliderRow(
                            label = "Shunt Capacitor (C_shunt)",
                            value = shuntC,
                            range = 0.0..50.0,
                            unit = "pF",
                            accentColor = Color(0xFF10B981),
                            onValueChange = { shuntC = it },
                            onStep = { shuntC = (shuntC + it).coerceIn(0.0, 50.0) }
                        )

                        CustomSliderRow(
                            label = "Shunt Inductor (L_shunt)",
                            value = shuntL,
                            range = 0.0..50.0,
                            unit = "nH",
                            accentColor = Color(0xFFF59E0B),
                            onValueChange = { shuntL = it },
                            onStep = { shuntL = (shuntL + it).coerceIn(0.0, 50.0) }
                        )
                    }
                }
            }
        }
    }
}

    // Direct Input Dialog for R & X
    if (showDirectInputDialog) {
        var inputRText by remember { mutableStateOf(loadR.toString()) }
        var inputXText by remember { mutableStateOf(loadX.toString()) }

        AlertDialog(
            onDismissRequest = { showDirectInputDialog = false },
            title = { Text("Set Load Impedance", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = inputRText,
                        onValueChange = { inputRText = it },
                        label = { Text("Resistance R (Ω)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
                    )
                    OutlinedTextField(
                        value = inputXText,
                        onValueChange = { inputXText = it },
                        label = { Text("Reactance X (jΩ)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
                    )
                }
            },
            confirmButton = {
                Button(onClick = {
                    inputRText.toDoubleOrNull()?.let { loadR = it.coerceIn(0.0, 1000.0) }
                    inputXText.toDoubleOrNull()?.let { loadX = it.coerceIn(-1000.0, 1000.0) }
                    showDirectInputDialog = false
                }) {
                    Text("Apply")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDirectInputDialog = false }) { Text("Cancel") }
            }
        )
    }
}

@Composable
fun MetricBox(
    modifier: Modifier = Modifier,
    label: String,
    value: String,
    valueColor: Color,
    bg: Color
) {
    Column(
        modifier = modifier
            .background(bg, shape = RoundedCornerShape(10.dp))
            .padding(10.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(label, fontSize = 10.sp, color = Color.Gray, maxLines = 1)
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = value,
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            color = valueColor,
            fontFamily = FontFamily.Monospace
        )
    }
}

@Composable
fun CustomSliderRow(
    label: String,
    value: Double,
    range: ClosedFloatingPointRange<Double>,
    unit: String,
    accentColor: Color,
    onValueChange: (Double) -> Unit,
    onStep: (Double) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(label, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f))
            Row(verticalAlignment = Alignment.CenterVertically) {
                // Step down button
                Surface(
                    shape = RoundedCornerShape(4.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    modifier = Modifier
                        .clickable { onStep(if (unit == "GHz") -0.1 else if (unit == "Ω") -5.0 else -1.0) }
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text("-", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = "${if (unit == "GHz" || unit == "λ") String.format("%.2f", value) else String.format("%.1f", value)} $unit",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = accentColor,
                    fontFamily = FontFamily.Monospace
                )
                Spacer(modifier = Modifier.width(6.dp))
                // Step up button
                Surface(
                    shape = RoundedCornerShape(4.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    modifier = Modifier
                        .clickable { onStep(if (unit == "GHz") 0.1 else if (unit == "Ω") 5.0 else 1.0) }
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text("+", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
        Slider(
            value = value.toFloat(),
            onValueChange = { onValueChange(it.toDouble()) },
            valueRange = range.start.toFloat()..range.endInclusive.toFloat()
        )
    }
}

@Composable
fun PresetChip(label: String, isSelected: Boolean, onClick: () -> Unit) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
        modifier = Modifier.clickable { onClick() }
    ) {
        Text(
            text = label,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
            color = if (isSelected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        )
    }
}

@Composable
fun TabButton(
    modifier: Modifier = Modifier,
    title: String,
    isSelected: Boolean,
    primaryColor: Color,
    textSecondary: Color,
    onClick: () -> Unit
) {
    Surface(
        modifier = modifier.clickable { onClick() },
        color = if (isSelected) primaryColor else Color.Transparent,
        shape = RoundedCornerShape(8.dp)
    ) {
        Box(
            modifier = Modifier.padding(vertical = 8.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = title,
                fontSize = 11.sp,
                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                color = if (isSelected) Color.White else textSecondary
            )
        }
    }
}
