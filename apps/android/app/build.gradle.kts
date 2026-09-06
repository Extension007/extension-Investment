import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "xyz.albamount.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "xyz.albamount.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 5
        versionName = "2.1.0"
        buildConfigField("String", "SITE_URL", "\"https://www.albamount.xyz/\"")
        buildConfigField("String", "PRIVACY_URL", "\"https://www.albamount.xyz/privacy\"")
        buildConfigField("String", "ACCOUNT_DELETION_URL", "\"https://www.albamount.xyz/cabinet\"")
    }

    signingConfigs {
        create("release") {
            val propsFile = rootProject.file("keystore.properties")
            if (propsFile.exists()) {
                val props = Properties()
                props.load(FileInputStream(propsFile))
                storeFile = rootProject.file(props["storeFile"] as String)
                storePassword = props["storePassword"] as String
                keyAlias = props["keyAlias"] as String
                keyPassword = props["keyPassword"] as String
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            val propsFile = rootProject.file("keystore.properties")
            if (propsFile.exists()) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
}
