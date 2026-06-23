package com.malscan.app;

import android.app.role.RoleManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Bridges Android's RoleManager (API 29+) so JS can ask the user to make
 * MalScan the default browser. Below API 29 there is no RoleManager —
 * isRoleAvailable() resolves false and callers should fall back to copy that
 * explains how to set it manually in system Settings.
 */
@CapacitorPlugin(name = "DefaultBrowser")
public class DefaultBrowserPlugin extends Plugin {

    private RoleManager getRoleManager() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return null;
        return (RoleManager) getContext().getSystemService(Context.ROLE_SERVICE);
    }

    @PluginMethod
    public void isRoleAvailable(PluginCall call) {
        RoleManager rm = getRoleManager();
        JSObject ret = new JSObject();
        ret.put("value", rm != null && rm.isRoleAvailable(RoleManager.ROLE_BROWSER));
        call.resolve(ret);
    }

    @PluginMethod
    public void isDefaultBrowser(PluginCall call) {
        RoleManager rm = getRoleManager();
        JSObject ret = new JSObject();
        ret.put("value", rm != null && rm.isRoleHeld(RoleManager.ROLE_BROWSER));
        call.resolve(ret);
    }

    /** Launches the system "Set MalScan as your default browser?" dialog. */
    @PluginMethod
    public void requestRole(PluginCall call) {
        RoleManager rm = getRoleManager();
        if (rm == null || !rm.isRoleAvailable(RoleManager.ROLE_BROWSER)) {
            call.reject("ROLE_BROWSER is not available on this device (requires Android 10+).", "UNAVAILABLE");
            return;
        }
        if (rm.isRoleHeld(RoleManager.ROLE_BROWSER)) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }

        Intent intent = rm.createRequestRoleIntent(RoleManager.ROLE_BROWSER);
        startActivityForResult(call, intent, "roleResult");
    }

    @ActivityCallback
    private void roleResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        // resultCode is RESULT_OK whether the user accepted or declined the
        // role — the only reliable signal is re-checking isRoleHeld().
        RoleManager rm = getRoleManager();
        JSObject ret = new JSObject();
        ret.put("granted", rm != null && rm.isRoleHeld(RoleManager.ROLE_BROWSER));
        call.resolve(ret);
    }
}
