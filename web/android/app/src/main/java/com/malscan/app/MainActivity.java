package com.malscan.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DefaultBrowserPlugin.class);
        registerPlugin(OpenFilePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
