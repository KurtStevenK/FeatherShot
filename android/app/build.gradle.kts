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
        versionCode = 1347
        versionName = "1.3.47"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Unsigned on purpose: a real release keystore is needed for Huawei AppGallery.
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

tasks.matching { it.name.startsWith("merge") && it.name.endsWith("Assets") }.configureEach {
    dependsOn(syncEditorAssets)
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.8.0")
    implementation("androidx.webkit:webkit:1.18.0")
    // No Google Play Services or Firebase on purpose: Huawei phones ship without GMS.
}
