plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "xyz.kainzmayer.feathershot"
    compileSdk = 36

    defaultConfig {
        // Same bundle family as the iOS app (xyz.kainzmayer.feathershot).
        applicationId = "xyz.kainzmayer.feathershot"
        minSdk = 29 // Android 10: MediaStore RELATIVE_PATH and IS_PENDING for saving to Pictures
        targetSdk = 36
        // CI passes -PappVersion=1.3.51 from the release tag; versionCode is 1.3.51 -> 10351.
        val appVersion = (project.findProperty("appVersion") as String?) ?: "1.3.51"
        val (major, minor, patch) = appVersion.split(".").map { it.toInt() }
        versionCode = major * 10000 + minor * 100 + patch
        versionName = appVersion
    }

    // Release signing comes from the environment (GitHub Actions secrets), never from the repo.
    // Without ANDROID_KEYSTORE_FILE the release APK is built unsigned.
    val keystoreFile = System.getenv("ANDROID_KEYSTORE_FILE")?.let { file(it) }
    signingConfigs {
        if (keystoreFile != null && keystoreFile.exists()) {
            create("release") {
                storeFile = keystoreFile
                storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("ANDROID_KEY_ALIAS")
                keyPassword = System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        // MainActivity uses BuildConfig.DEBUG to enable WebView debugging in debug builds only.
        buildConfig = true
    }
}

// The annotation editor lives in chrome-extension/ and is shared with Chrome.
// Copy it into the APK assets at build time so there is a single source of truth.
val syncEditorAssets by tasks.registering(Copy::class) {
    description = "Copies the shared chrome-extension editor into the APK assets."
    from(rootProject.file("../chrome-extension")) {
        include("editor.html", "editor.css", "editor.js", "letterLabel.js")
        into("editor")
    }
    into(layout.buildDirectory.dir("generated/editor-assets"))
}

android {
    sourceSets.getByName("main").assets.srcDir(layout.buildDirectory.dir("generated/editor-assets"))
}

// Every task that reads the assets (asset merging and the release lint check) needs the copy first.
tasks.matching {
    (it.name.startsWith("merge") && it.name.endsWith("Assets")) || it.name.contains("lint", ignoreCase = true)
}.configureEach {
    dependsOn(syncEditorAssets)
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.8.0")
    implementation("androidx.webkit:webkit:1.18.0")
    // No Google Play Services or Firebase on purpose: Huawei phones ship without GMS.
}
