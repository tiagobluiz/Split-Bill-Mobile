package com.miagology.aihandover

import android.content.ClipData
import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class AiHandoverModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AiHandover")

    AsyncFunction("open") { params: Map<String, Any?>, promise: Promise ->
      val provider = params["provider"] as? String ?: throw IllegalArgumentException("Missing provider")
      val prompt = params["prompt"] as? String ?: throw IllegalArgumentException("Missing prompt")
      val imageUri = params["invoicePhotoUri"] as? String
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.resolve(mapOf("opened" to false, "promptPrefilled" to false, "imageAttached" to false))
        return@AsyncFunction
      }

      val packageName = when (provider) {
        "chatgpt" -> "com.openai.chatgpt"
        "gemini" -> "com.google.android.apps.bard"
        else -> throw IllegalArgumentException("Unsupported AI handover provider")
      }
      val photo = runCatching {
        imageUri?.let { value ->
          val parsed = Uri.parse(value)
          val file = when (parsed.scheme) {
            "file" -> File(parsed.path ?: "")
            null -> File(value)
            else -> null
          }
          if (file?.isFile == true) FileProvider.getUriForFile(
            activity,
            "${activity.packageName}.FileSystemFileProvider",
            file,
          ) else null
        }
      }.getOrNull()

      fun sendText() {
        val intent = Intent(Intent.ACTION_SEND).setType("text/plain").setPackage(packageName)
          .putExtra(Intent.EXTRA_TEXT, prompt)
        activity.startActivity(intent)
      }

      try {
        if (photo != null) {
          val intent = Intent(Intent.ACTION_SEND).setType(activity.contentResolver.getType(photo) ?: "image/jpeg")
            .setPackage(packageName)
            .putExtra(Intent.EXTRA_STREAM, photo)
          intent.clipData = ClipData.newUri(activity.contentResolver, "Invoice photo", photo)
          intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
          if (provider == "chatgpt") intent.putExtra(Intent.EXTRA_TEXT, prompt)
          if (intent.resolveActivity(activity.packageManager) == null) throw IllegalStateException("No AI app can receive the invoice")
          activity.startActivity(intent)
          promise.resolve(mapOf("opened" to true, "promptPrefilled" to (provider == "chatgpt"), "imageAttached" to true))
        } else {
          sendText()
          promise.resolve(mapOf("opened" to true, "promptPrefilled" to true, "imageAttached" to false))
        }
      } catch (_: Exception) {
        promise.resolve(mapOf("opened" to false, "promptPrefilled" to false, "imageAttached" to false))
      }
    }
  }
}
