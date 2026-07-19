package com.malscan.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import java.io.File;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Opens a scanned file with whatever app the user picks (PDF viewer, image
 * viewer, etc.) once MalScan has cleared it — the Android equivalent of the
 * old Expo app's expo-intent-launcher "Open File" action.
 *
 * Handles two URI shapes, since both feed in from different sources:
 *  - content:// — already shareable as-is (came straight from a VIEW intent).
 *  - a plain absolute path — came from the share-target plugin's cache copy
 *    and needs FileProvider to turn it into a content:// URI Android will
 *    grant another app permission to read.
 */
@CapacitorPlugin(name = "OpenFile")
public class OpenFilePlugin extends Plugin {

    @PluginMethod
    public void open(PluginCall call) {
        String path = call.getString("path");
        String mimeType = call.getString("mimeType", "*/*");

        if (path == null) {
            call.reject("Missing 'path'");
            return;
        }

        try {
            Uri uri;
            if (path.startsWith("content://")) {
                uri = Uri.parse(path);
            } else {
                File file = new File(path);
                uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            }

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, mimeType);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            getActivity().startActivity(intent);
            call.resolve(new JSObject());
        } catch (ActivityNotFoundException e) {
            call.reject("No app found that can open this file type.", e);
        } catch (Exception e) {
            call.reject("Could not open file: " + e.getMessage(), e);
        }
    }
}
