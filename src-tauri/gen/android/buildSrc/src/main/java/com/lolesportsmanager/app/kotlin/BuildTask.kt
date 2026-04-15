import java.io.File
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import org.apache.tools.ant.taskdefs.condition.Os
import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.logging.LogLevel
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.TaskAction

open class BuildTask : DefaultTask() {
    @Input
    var rootDirRel: String? = null

    @Input
    var target: String? = null

    @Input
    var release: Boolean? = null

    @TaskAction
    fun assemble() {
        val repoRoot = File(project.projectDir, rootDirRel ?: throw GradleException("rootDirRel cannot be null")).canonicalFile
        val cargoTarget = cargoTargetTriple(target ?: throw GradleException("target cannot be null"))
        val profileName = if (release == true) "release" else "debug"
        val androidEnv = resolveAndroidEnv(repoRoot, cargoTarget)
        val cargoExecutable = candidateCargoExecutables().firstOrNull()
            ?: throw GradleException("Unable to find cargo executable")

        val args = mutableListOf(
            "build",
            "--manifest-path",
            "src-tauri/Cargo.toml",
            "--target",
            cargoTarget,
            "--lib",
        )
        if (release == true) {
            args.add("--release")
        }

        project.exec {
            workingDir(repoRoot)
            executable(cargoExecutable)
            args(args)
            environment(androidEnv)
            if (project.logger.isEnabled(LogLevel.INFO)) {
                environment("CARGO_TERM_VERBOSE", "true")
            }
        }.rethrowFailure().assertNormalExitValue()

        val sourceSo = File(repoRoot, "src-tauri/target/$cargoTarget/$profileName/liblol_esports_manager_lib.so")
        if (!sourceSo.exists()) {
            throw GradleException("Expected Android library was not produced: ${sourceSo.absolutePath}")
        }

        val abiDir = File(project.projectDir, "src/main/jniLibs/${abiFolderName(cargoTarget)}")
        abiDir.mkdirs()
        val targetSo = File(abiDir, sourceSo.name)
        Files.copy(sourceSo.toPath(), targetSo.toPath(), StandardCopyOption.REPLACE_EXISTING)
    }

    private fun candidateCargoExecutables(): List<String> {
        val candidates = mutableListOf("cargo")
        if (Os.isFamily(Os.FAMILY_WINDOWS)) {
            candidates.addAll(
                listOf(
                    "cargo.exe",
                    File(System.getProperty("user.home"), ".cargo\\bin\\cargo.exe").absolutePath,
                )
            )
        }
        return candidates.distinct().filter { candidate ->
            candidate == "cargo" || candidate == "cargo.exe" || File(candidate).exists()
        }
    }

    private fun cargoTargetTriple(target: String): String = when (target) {
        "aarch64" -> "aarch64-linux-android"
        "armv7" -> "armv7-linux-androideabi"
        "i686" -> "i686-linux-android"
        "x86_64" -> "x86_64-linux-android"
        else -> throw GradleException("Unsupported Android target: $target")
    }

    private fun abiFolderName(cargoTarget: String): String = when (cargoTarget) {
        "aarch64-linux-android" -> "arm64-v8a"
        "armv7-linux-androideabi" -> "armeabi-v7a"
        "i686-linux-android" -> "x86"
        "x86_64-linux-android" -> "x86_64"
        else -> throw GradleException("Unsupported cargo Android target: $cargoTarget")
    }

    private fun resolveAndroidEnv(repoRoot: File, cargoTarget: String): Map<String, String> {
        val env = System.getenv().toMutableMap()
        val sdkRoot = env["ANDROID_SDK_ROOT"]
            ?: env["ANDROID_HOME"]
            ?: File(repoRoot, ".android-sdk").takeIf { it.exists() }?.absolutePath
            ?: throw GradleException("ANDROID_SDK_ROOT / ANDROID_HOME not configured")

        env["ANDROID_HOME"] = sdkRoot
        env["ANDROID_SDK_ROOT"] = sdkRoot

        val ndkRoot = env["NDK_HOME"] ?: File(sdkRoot, "ndk").listFiles()
            ?.filter { it.isDirectory }
            ?.maxByOrNull { it.name }
            ?.absolutePath
            ?: throw GradleException("NDK_HOME could not be resolved")

        env["NDK_HOME"] = ndkRoot

        val llvmBin = File(ndkRoot, "toolchains/llvm/prebuilt/windows-x86_64/bin")
        if (!llvmBin.exists()) {
            throw GradleException("Android NDK LLVM toolchain not found: ${llvmBin.absolutePath}")
        }

        val linkerBase = when (cargoTarget) {
            "aarch64-linux-android" -> "aarch64-linux-android24-clang.cmd"
            "armv7-linux-androideabi" -> "armv7a-linux-androideabi24-clang.cmd"
            "i686-linux-android" -> "i686-linux-android24-clang.cmd"
            "x86_64-linux-android" -> "x86_64-linux-android24-clang.cmd"
            else -> throw GradleException("No linker configured for $cargoTarget")
        }

        val linker = File(llvmBin, linkerBase).absolutePath
        val ar = File(llvmBin, "llvm-ar.exe").absolutePath

        env["PATH"] = listOf(
            llvmBin.absolutePath,
            File(sdkRoot, "platform-tools").absolutePath,
            env["PATH"] ?: "",
        ).filter { it.isNotBlank() }.joinToString(File.pathSeparator)

        val cargoEnvKey = cargoTarget.uppercase().replace('-', '_')
        env["CARGO_TARGET_${cargoEnvKey}_LINKER"] = linker
        env["CC_${cargoEnvKey}"] = linker
        env["CXX_${cargoEnvKey}"] = linker.replace("-clang.cmd", "-clang++.cmd")
        env["AR_${cargoEnvKey}"] = ar

        if (Os.isFamily(Os.FAMILY_WINDOWS) && env["JAVA_HOME"].isNullOrBlank()) {
            val fallbackJavaHome = File(System.getProperty("user.home"), ".jdks/azul-17.0.17")
            if (fallbackJavaHome.exists()) {
                env["JAVA_HOME"] = fallbackJavaHome.absolutePath
                env["PATH"] = listOf(
                    File(fallbackJavaHome, "bin").absolutePath,
                    env["PATH"] ?: "",
                ).filter { it.isNotBlank() }.joinToString(File.pathSeparator)
            }
        }

        return env
    }
}
