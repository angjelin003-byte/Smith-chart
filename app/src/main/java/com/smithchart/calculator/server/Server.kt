package com.smithchart.calculator.server

import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStream
import java.net.ServerSocket
import java.net.Socket
import kotlin.concurrent.thread

/**
 * Pure Kotlin companion server for Smith Chart Calculator.
 * Uses standard java.net.ServerSocket (fully compatible with Android runtime and standard JVM).
 */
object SmithChartServer {
    private const val PORT = 3000

    @JvmStatic
    fun main(args: Array<String>) {
        startServer(blocking = true)
    }

    fun startServer(blocking: Boolean = false) {
        val runBlock = {
            try {
                val serverSocket = ServerSocket(PORT)
                println("Kotlin companion server listening on port $PORT")
                while (!serverSocket.isClosed) {
                    val client = serverSocket.accept()
                    thread { handleClient(client) }
                }
            } catch (e: Exception) {
                System.err.println("Kotlin Server error: ${e.message}")
            }
        }

        if (blocking) {
            runBlock()
        } else {
            thread(isDaemon = true, name = "SmithChartServer") { runBlock() }
        }
    }

    private fun handleClient(socket: Socket) {
        socket.use { s ->
            try {
                val reader = BufferedReader(InputStreamReader(s.getInputStream()))
                val line = reader.readLine() ?: return
                // Drain headers
                var header = reader.readLine()
                while (!header.isNullOrEmpty()) {
                    header = reader.readLine()
                }

                val html = """
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Smith Chart Calculator - Android Kotlin App</title>
                        <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
                    </head>
                    <body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col items-center justify-center p-6">
                        <div class="max-w-3xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
                            <div class="flex items-center space-x-3 mb-6">
                                <div class="w-12 h-12 bg-cyan-500/10 border border-cyan-500/30 rounded-xl flex items-center justify-center text-cyan-400 font-bold text-xl">
                                    ⚡
                                </div>
                                <div>
                                    <h1 class="text-2xl font-bold tracking-tight">Smith Chart Calculator</h1>
                                    <p class="text-sm text-slate-400">100% Pure Kotlin Android App with Jetpack Compose</p>
                                </div>
                            </div>

                            <div class="space-y-6">
                                <div class="bg-slate-950/60 border border-slate-800/80 rounded-xl p-5">
                                    <h2 class="text-lg font-semibold text-cyan-400 mb-2">🚀 GitHub Actions Cloud Build Ready</h2>
                                    <p class="text-slate-300 text-sm leading-relaxed">
                                        Since you are on mobile web and cannot run a local Gradle terminal, this repository is fully configured with automated GitHub Actions CI/CD (<code class="bg-slate-800 px-1.5 py-0.5 rounded text-cyan-300">.github/workflows/build.yml</code>).
                                    </p>
                                </div>

                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div class="bg-slate-950/40 border border-slate-800 p-4 rounded-xl">
                                        <h3 class="font-semibold text-slate-200 mb-1">📱 Features</h3>
                                        <ul class="text-sm text-slate-400 space-y-1 list-disc list-inside">
                                            <li>Interactive Smith Chart Canvas</li>
                                            <li>Real-time Load R & X Sliders</li>
                                            <li>VSWR & Return Loss Metrics</li>
                                            <li>Series L/C & Transmission Line stub matching</li>
                                        </ul>
                                    </div>
                                    <div class="bg-slate-950/40 border border-slate-800 p-4 rounded-xl">
                                        <h3 class="font-semibold text-slate-200 mb-1">🛠️ How to Get APK</h3>
                                        <ol class="text-sm text-slate-400 space-y-1 list-decimal list-inside">
                                            <li>Push repo to GitHub</li>
                                            <li>Go to <strong>Actions</strong> tab</li>
                                            <li>Run <strong>Build Android APK</strong></li>
                                            <li>Download artifact directly to phone!</li>
                                        </ol>
                                    </div>
                                </div>

                                <div class="flex items-center justify-between pt-4 border-t border-slate-800 text-xs text-slate-500">
                                    <span>Status: Server Active on Port 3000 (Kotlin)</span>
                                    <span class="text-cyan-400 font-mono">Kotlin 1.9 + Jetpack Compose 34</span>
                                </div>
                            </div>
                        </div>
                    </body>
                    </html>
                """.trimIndent()

                val bodyBytes = html.toByteArray(Charsets.UTF_8)
                val responseHeaders = "HTTP/1.1 200 OK\r\n" +
                        "Content-Type: text/html; charset=utf-8\r\n" +
                        "Content-Length: ${bodyBytes.size}\r\n" +
                        "Connection: close\r\n\r\n"

                val out: OutputStream = s.getOutputStream()
                out.write(responseHeaders.toByteArray(Charsets.UTF_8))
                out.write(bodyBytes)
                out.flush()
            } catch (ignored: Exception) {
            }
        }
    }
}

fun main(args: Array<String>) {
    SmithChartServer.main(args)
}
