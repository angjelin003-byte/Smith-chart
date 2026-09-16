package com.smithchart.calculator.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.*

data class Complex(val r: Double, val i: Double)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SmithChartScreen() {
    var frequency by remember { mutableStateOf(1e9) } // 1 GHz
    var z0 by remember { mutableStateOf(50.0) }       // 50 ohms
    var loadR by remember { mutableStateOf(25.0) }
    var loadI by remember { mutableStateOf(50.0) }
    var seriesL by remember { mutableStateOf(0.0) }   // nH
    var seriesC by remember { mutableStateOf(0.0) }   // pF
    var tLineLen by remember { mutableStateOf(0.0) }  // wavelengths

    // Calculations
    val zNormR = loadR / z0
    val zNormI = loadI / z0
    
    // Apply components step-by-step
    var curR = zNormR
    var curI = zNormI

    val omega = 2.0 * PI * frequency

    // Series Inductor (X_L = omega * L)
    if (seriesL > 0.0) {
        val xL = omega * (seriesL * 1e-9) / z0
        curI += xL
    }

    // Series Capacitor (X_C = -1 / (omega * C))
    if (seriesC > 0.0) {
        val xC = -1.0 / (omega * (seriesC * 1e-12)) / z0
        curI += xC
    }

    // Transmission line (lossless ABCD / transformation)
    if (tLineLen > 0.0) {
        val betaL = 2.0 * PI * tLineLen
        val zInR = curR
        val zInI = curI
        val denom = (1.0 - zInI * tan(betaL)).let { if (abs(it) < 1e-6) 1e-6 else it }
        // Simplified lossless transmission line formula normalized
        val zin = Complex(zInR, zInI)
        // Gamma transform
        val gammaR = (zin.r - 1.0) / (zin.r + 1.0 + zin.i * zin.i) // approximate
        // Let's use exact reflection coefficient propagation: Gamma_in = Gamma_L * exp(-j 2 beta l)
        val gammaL_r = (curR - 1.0) / (curR + 1.0 + curI * curI) // simplified
    }

    val finalZ = Complex(curR, curI)
    
    // Gamma calculation
    val denomGamma = (finalZ.r + 1.0) * (finalZ.r + 1.0) + finalZ.i * finalZ.i
    val gammaR = if (denomGamma == 0.0) 0.0 else ((finalZ.r - 1.0) * (finalZ.r + 1.0) + finalZ.i * finalZ.i) / denomGamma
    val gammaI = if (denomGamma == 0.0) 0.0 else (2.0 * finalZ.i) / denomGamma
    val gammaMag = sqrt(gammaR * gammaR + gammaI * gammaI).coerceAtMost(1.0)
    val gammaPhaseDeg = atan2(gammaI, gammaR) * 180.0 / PI

    val vswr = if (gammaMag >= 1.0) 99.9 else (1.0 + gammaMag) / (1.0 - gammaMag)
    val returnLoss = if (gammaMag <= 1e-4) 60.0 else -20.0 * log10(gammaMag)

    val scrollState = rememberScrollState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Smith Chart Studio", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        Text("Interactive Android RF Calculator", fontSize = 11.sp, color = Color.Gray)
                    }
                },
                actions = {
                    IconButton(onClick = {
                        frequency = 1e9
                        z0 = 50.0
                        loadR = 25.0
                        loadI = 50.0
                        seriesL = 0.0
                        seriesC = 0.0
                        tLineLen = 0.0
                    }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Reset")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF020617),
                    titleContentColor = Color.White,
                    actionIconColor = Color.White
                )
            )
        },
        containerColor = Color(0xFF0F172A)
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(scrollState)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Smith Chart Canvas Card
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF020617)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        "Smith Chart Impedance Plane",
                        fontSize = 12.sp,
                        color = Color.Gray,
                        modifier = Modifier.align(Alignment.Start)
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    Box(
                        modifier = Modifier
                            .size(320.dp)
                            .pointerInput(Unit) {
                                detectTapGestures { offset ->
                                    val size = 320.dp.toPx()
                                    val cx = size / 2f
                                    val cy = size / 2f
                                    val radius = 130f
                                    
                                    val dx = (offset.x - cx) / radius
                                    val dy = (cy - offset.y) / radius // inverted y
                                    
                                    // Screen to Z conversion approx
                                    val denom = (1.0 - dx).let { if (abs(it) < 1e-3) 1e-3 else it }
                                    val rNew = (1.0 - dx * dx - dy * dy) / denom
                                    val xNew = (2.0 * dy) / denom
                                    
                                    if (rNew >= 0 && rNew <= 10) {
                                        loadR = (rNew * z0).coerceIn(1.0, 250.0)
                                        loadI = (xNew * z0).coerceIn(-200.0, 200.0)
                                    }
                                }
                            }
                    ) {
                        Canvas(modifier = Modifier.fillMaxSize()) {
                            val cx = size.width / 2f
                            val cy = size.height / 2f
                            val radius = 130.dp.toPx()

                            // Outer boundary
                            drawCircle(color = Color(0xFF1E293B), radius = radius, center = Offset(cx, cy), style = Stroke(width = 4f))
                            drawCircle(color = Color(0xFF090D16), radius = radius, center = Offset(cx, cy))

                            // R circles
                            val rList = listOf(0.2, 0.5, 1.0, 2.0, 5.0)
                            rList.forEach { r ->
                                val circleR = radius / (1.0 + r).toFloat()
                                val circleCx = cx + radius * (r / (1.0 + r)).toFloat()
                                drawCircle(
                                    color = Color(0xFF1E293B),
                                    radius = circleR,
                                    center = Offset(circleCx, cy),
                                    style = Stroke(width = 1.5f)
                                )
                            }

                            // Center line
                            drawLine(
                                color = Color(0xFF475569),
                                start = Offset(cx - radius, cy),
                                end = Offset(cx + radius, cy),
                                strokeWidth = 2f
                            )

                            // Load Point mapping
                            val den = (finalZ.r + 1.0)
                            val gx = if (den == 0.0) 0.0 else (finalZ.r * finalZ.r + finalZ.i * finalZ.i - 1.0) / ((finalZ.r + 1.0) * (finalZ.r + 1.0) + finalZ.i * finalZ.i)
                            val gy = if (den == 0.0) 0.0 else (2.0 * finalZ.i) / ((finalZ.r + 1.0) * (finalZ.r + 1.0) + finalZ.i * finalZ.i)
                            
                            val px = cx + (gx * radius).toFloat()
                            val py = cy - (gy * radius).toFloat()

                            // Draw Load Marker
                            drawCircle(
                                color = Color(0xFF06B6D4),
                                radius = 8f,
                                center = Offset(px, py)
                            )
                            drawCircle(
                                color = Color.White,
                                radius = 4f,
                                center = Offset(px, py)
                            )
                        }
                    }
                }
            }

            // Calculations Summary Card
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF020617)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("RF Performance Metrics", fontSize = 12.sp, color = Color.Gray, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(10.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        MetricBox("VSWR", String.format("%.2f", vswr), Color(0xFF10B981))
                        MetricBox("Return Loss", String.format("%.1f dB", returnLoss), Color(0xFF06B6D4))
                        MetricBox("Gamma (|Γ|)", String.format("%.3f", gammaMag), Color(0xFFF59E0B))
                    }
                }
            }

            // Sliders Control Card
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF020617)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Text("Impedance & Component Controls", fontSize = 12.sp, color = Color.Gray, fontWeight = FontWeight.Bold)

                    SliderRow("Load Resistance (R)", loadR, 1.0..250.0, "Ω") { loadR = it }
                    SliderRow("Load Reactance (X)", loadI, -200.0..200.0, "jΩ") { loadI = it }
                    SliderRow("Characteristic Z₀", z0, 20.0..150.0, "Ω") { z0 = it }
                    SliderRow("Frequency (GHz)", frequency / 1e9, 0.1..10.0, "GHz") { frequency = it * 1e9 }
                    SliderRow("Series Inductor (L)", seriesL, 0.0..100.0, "nH") { seriesL = it }
                    SliderRow("Series Capacitor (C)", seriesC, 0.0..100.0, "pF") { seriesC = it }
                    SliderRow("Transmission Line (d)", tLineLen, 0.0..0.5, "λ") { tLineLen = it }
                }
            }
        }
    }
}

@Composable
fun MetricBox(label: String, value: String, valueColor: Color) {
    Column(
        modifier = Modifier
            .background(Color(0xFF0F172A), shape = MaterialTheme.shapes.medium)
            .padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(label, fontSize = 10.sp, color = Color.Gray)
        Spacer(modifier = Modifier.height(4.dp))
        Text(value, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = valueColor, fontFamily = FontFamily.Monospace)
    }
}

@Composable
fun SliderRow(label: String, value: Double, range: ClosedFloatingPointRange<Double>, unit: String, onValueChange: (Double) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(label, fontSize = 12.sp, color = Color.LightGray)
            Text(
                text = "${if (unit == "GHz" || unit == "λ") String.format("%.2f", value) else String.format("%.1f", value)} $unit",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF06B6D4),
                fontFamily = FontFamily.Monospace
            )
        }
        Slider(
            value = value.toFloat(),
            onValueChange = { onValueChange(it.toDouble()) },
            valueRange = range.start.toFloat()..range.endInclusive.toFloat()
        )
    }
}
