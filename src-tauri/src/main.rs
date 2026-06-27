use serde::{Deserialize, Serialize};
use tauri::Manager;

use nimi_shell_tauri::capabilities::{oauth, runtime, runtime_defaults, session_logging};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConfirmDialogPayload {
    #[allow(dead_code)]
    title: Option<String>,
    #[allow(dead_code)]
    description: Option<String>,
    #[allow(dead_code)]
    level: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ConfirmDialogResult {
    confirmed: bool,
}

fn start_dragging_window(window: tauri::WebviewWindow) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    if window.is_fullscreen().unwrap_or(false) {
        return Ok(());
    }

    match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        window.start_dragging().map_err(|error| error.to_string())
    })) {
        Ok(result) => result,
        Err(_) => Err("window drag unavailable".to_string()),
    }
}

#[tauri::command]
fn start_window_drag(window: tauri::WebviewWindow) -> Result<(), String> {
    start_dragging_window(window)
}

#[tauri::command]
fn focus_main_window(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .or_else(|| app.webview_windows().into_values().next())
        .ok_or_else(|| "main window unavailable".to_string())?;
    let _ = window.unminimize();
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

#[tauri::command]
fn confirm_dialog(payload: ConfirmDialogPayload) -> Result<ConfirmDialogResult, String> {
    let _ = payload;
    Err(nimi_shell_tauri::capabilities::standard_shell_error(
        "capability-unavailable",
        "overtone-native-confirm-dialog-unavailable",
        "Use Overtone in-app confirmation UI for product confirmations.",
        "tauri",
        None,
    ))
}

fn tester_renderer_entry_probe_script() -> Result<String, String> {
    nimi_shell_tauri::capabilities::diagnostics::build_renderer_entry_probe_script(
        &nimi_shell_tauri::capabilities::diagnostics::RendererEntryProbeScriptConfig {
            started_flag: "__NIMI_TESTER_RENDERER_PROBE_STARTED__".to_string(),
            ping_command: "tester_renderer_probe_ping".to_string(),
            report_command: "tester_renderer_probe_report_write".to_string(),
            context_command: "tester_renderer_probe_context_get".to_string(),
            reset_local_storage_scenario_ids: Vec::new(),
        },
    )
}

fn main() {
    session_logging::set_app_session_prefix("overtone");
    session_logging::install_panic_hook();
    session_logging::log_boot_marker("overtone main() entered");

    tauri::Builder::default()
        .on_page_load(|webview, payload| {
            if !matches!(payload.event(), tauri::webview::PageLoadEvent::Finished) {
                return;
            }
            if let Ok(script) = tester_renderer_entry_probe_script() {
                let _ = webview.eval(script.as_str());
            }
        })
        .invoke_handler(tauri::generate_handler![
            runtime_defaults::runtime_defaults,
            oauth::open_external_url,
            oauth::oauth_listen_for_code,
            runtime::runtime_bridge_unary,
            runtime::runtime_bridge_stream_open,
            runtime::runtime_bridge_stream_close,
            runtime::runtime_bridge_status,
            session_logging::log_renderer_event,
            confirm_dialog,
            start_window_drag,
            focus_main_window,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Nimi Overtone shell");
}

#[cfg(test)]
mod tests {
    use std::time::{SystemTime, UNIX_EPOCH};

    use nimi_shell_tauri::capabilities::{
        ai_profile, config, data, local_agent, local_assets, platform_projection, runtime,
        runtime_defaults,
    };

    fn with_env_vars(vars: &[(&str, Option<&str>)], run: impl FnOnce()) {
        let saved: Vec<(String, Option<String>)> = vars
            .iter()
            .map(|(key, _)| ((*key).to_string(), std::env::var(key).ok()))
            .collect();
        for (key, value) in vars {
            match value {
                Some(value) => std::env::set_var(key, value),
                None => std::env::remove_var(key),
            }
        }

        run();

        for (key, value) in saved {
            match value {
                Some(value) => std::env::set_var(&key, value),
                None => std::env::remove_var(&key),
            }
        }
    }

    #[test]
    fn tester_consumes_shared_renderer_entry_probe_from_kit() {
        let script = super::tester_renderer_entry_probe_script().expect("probe script");

        assert!(script.contains("__NIMI_TESTER_RENDERER_PROBE_STARTED__"));
        assert!(script.contains("tester_renderer_probe_ping"));
        assert!(script.contains("tester_renderer_probe_report_write"));
        assert!(script.contains("tester_renderer_probe_context_get"));
        assert!(script.contains("return import(scriptSrc);"));
        let forbidden_desktop_command = ["desktop", "macos", "smoke", "ping"].join("_");
        assert!(!script.contains(forbidden_desktop_command.as_str()));
    }

    #[test]
    fn tester_consumes_shared_platform_catalog_from_kit() {
        let first_run_profile =
            ai_profile::verify_first_run_factory_ai_profile("local-speech-ready", "minimal")
                .expect("first-run profile");
        assert_eq!(first_run_profile.alias, "local-speech-ready");

        let descriptor = platform_projection::nimi_app_registry::resolve_release_descriptor(
            "nimi.avatar.bundled-with-nimi",
        )
        .expect("avatar release descriptor");
        assert_eq!(descriptor.app_id, "nimi.avatar");

        let app_registry = platform_projection::apps_registry::build_apps_registry_record()
            .expect("apps registry projection");
        assert!(app_registry
            .apps
            .iter()
            .any(|row| row.app_id == "nimi.avatar"));
        let profile_index =
            platform_projection::factory_profile_index::build_factory_profile_index_record()
                .expect("factory profile index projection");
        assert!(profile_index
            .profiles
            .iter()
            .any(|row| row.alias == "local-speech-ready"));

        let bridge_projection = platform_projection::apps_bridge::build_apps_bridge_projection(
            "~/.nimi/apps/registry.json".to_string(),
            "~/.nimi/apps/packages.json".to_string(),
        )
        .expect("apps bridge projection");
        assert_eq!(
            bridge_projection.registry_rows.len(),
            platform_projection::nimi_app_registry::PLATFORM_NIMI_APP_REGISTRY_ROWS.len()
        );
    }

    #[test]
    fn tester_consumes_shared_platform_projection_materializers_from_kit() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time")
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("nimi-overtone-platform-projection-{unique}"));
        let registry_path = dir.join("apps").join("registry.json");
        let factory_path = dir.join("profiles").join("factory-index.json");

        let registry_outcome =
            platform_projection::apps_registry::materialize_apps_registry_projection(
                &registry_path,
            )
            .expect("materialize registry");
        assert!(matches!(
            registry_outcome,
            config::ConfigReadOutcome::Ready(_)
        ));
        assert!(registry_path.exists());

        let factory_outcome = platform_projection::factory_profile_index::materialize_factory_profile_index_projection(
            &factory_path,
        )
        .expect("materialize factory index");
        assert!(matches!(
            factory_outcome,
            config::ConfigReadOutcome::Ready(_)
        ));
        assert!(factory_path.exists());

        let future_registry_path = dir.join("apps").join("future-registry.json");
        let mut future_registry = platform_projection::apps_registry::build_apps_registry_record()
            .expect("registry record");
        future_registry.schema_version = 9999;
        let future_registry_raw =
            serde_json::to_string_pretty(&future_registry).expect("registry json");
        std::fs::write(&future_registry_path, &future_registry_raw).expect("write registry");

        match platform_projection::apps_registry::materialize_apps_registry_projection(
            &future_registry_path,
        )
        .expect("future registry materialize")
        {
            config::ConfigReadOutcome::Repair { severity, reason } => {
                assert_eq!(severity, config::ConfigRepairSeverity::RepairRequired);
                assert!(reason.contains("newer than the supported version"));
            }
            other => panic!("expected registry repair state, got {other:?}"),
        }
        assert_eq!(
            std::fs::read_to_string(&future_registry_path).expect("read registry"),
            future_registry_raw
        );

        let future_factory_path = dir.join("profiles").join("future-factory-index.json");
        let mut future_factory =
            platform_projection::factory_profile_index::build_factory_profile_index_record()
                .expect("factory record");
        future_factory.schema_version = 9999;
        let future_factory_raw =
            serde_json::to_string_pretty(&future_factory).expect("factory json");
        std::fs::write(&future_factory_path, &future_factory_raw).expect("write factory");

        match platform_projection::factory_profile_index::materialize_factory_profile_index_projection(
            &future_factory_path,
        )
        .expect("future factory materialize")
        {
            config::ConfigReadOutcome::Repair { severity, reason } => {
                assert_eq!(
                    severity,
                    config::ConfigRepairSeverity::RepairRequired
                );
                assert!(reason.contains("newer than the supported version"));
            }
            other => panic!("expected factory repair state, got {other:?}"),
        }
        assert_eq!(
            std::fs::read_to_string(&future_factory_path).expect("read factory"),
            future_factory_raw
        );
    }

    #[test]
    fn tester_consumes_shared_governed_config_repair_framework() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time")
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("nimi-overtone-governed-config-{unique}"));
        std::fs::create_dir_all(&dir).expect("create temp dir");
        let path = dir.join("probe.json");
        let ready_path = dir.join("nested").join("ready.json");
        config::write_governed_json_config(
            &ready_path,
            &serde_json::json!({
                "schemaVersion": 1,
                "displayName": "ready"
            }),
            |record| {
                if record
                    .get("schemaVersion")
                    .and_then(serde_json::Value::as_u64)
                    == Some(1)
                {
                    Ok(())
                } else {
                    Err("schemaVersion mismatch".to_string())
                }
            },
        )
        .expect("write governed config");
        assert!(ready_path.exists());

        std::fs::write(
            &path,
            serde_json::to_string_pretty(&serde_json::json!({
                "schemaVersion": 99,
                "displayName": "future"
            }))
            .expect("json"),
        )
        .expect("write probe");

        let file = config::GovernedConfigFile::new("tester_probe", "~/.nimi/tester/probe.json", 1);
        let outcome = config::read_governed_config(&file, &path, |document| Ok(document.clone()))
            .expect("read governed config");

        match outcome {
            config::ConfigReadOutcome::Repair { severity, reason } => {
                assert_eq!(severity, config::ConfigRepairSeverity::RepairRequired);
                assert!(reason.contains("newer than the supported version"));
                assert!(reason.contains("~/.nimi/tester/probe.json"));
            }
            other => panic!("expected shared governed-config repair state, got {other:?}"),
        }
    }

    #[test]
    fn tester_consumes_shared_runtime_defaults_projection() {
        with_env_vars(
            &[
                ("NIMI_REALM_URL", Some("http://localhost")),
                ("NIMI_REALM_JWKS_URL", None),
                ("NIMI_REALM_REVOCATION_URL", None),
                ("NIMI_REALM_JWT_ISSUER", None),
                ("NIMI_REALM_JWT_AUDIENCE", None),
                ("NIMI_ACCESS_TOKEN", Some("tester-runtime-token")),
                (
                    "NIMI_LOCAL_PROVIDER_ENDPOINT",
                    Some("http://127.0.0.1:1234/v1"),
                ),
                ("NIMI_LOCAL_PROVIDER_MODEL", Some("legacy-model")),
                ("NIMI_PROVIDER", Some("legacy-provider")),
            ],
            || {
                let defaults = runtime_defaults::runtime_defaults();
                assert_eq!(defaults.realm.realm_base_url, "http://localhost:3002");
                assert_eq!(
                    defaults.realm.jwks_url,
                    "http://localhost:3002/api/auth/jwks"
                );
                assert_eq!(
                    defaults.realm.revocation_url,
                    "http://localhost:3002/api/auth/sessions/introspect"
                );
                assert_eq!(defaults.realm.jwt_issuer, "http://localhost:3002");
                assert_eq!(defaults.realm.jwt_audience, "nimi-runtime");
                assert_eq!(defaults.realm.access_token, "tester-runtime-token");

                let runtime = serde_json::to_value(defaults.runtime).expect("runtime json");
                for retired_key in [
                    "localProviderEndpoint",
                    "localProviderModel",
                    "localOpenAiEndpoint",
                    "connectorId",
                    "provider",
                ] {
                    assert!(
                        runtime.get(retired_key).is_none(),
                        "shared runtime defaults must not emit retired route field {retired_key}"
                    );
                }
            },
        );
    }

    #[test]
    fn tester_consumes_shared_runtime_account_caller_projection() {
        let caller =
            local_agent::local_developer_runtime_account_caller("nimi.overtone").expect("caller");

        assert_eq!(caller.app_id, "nimi.overtone");
        assert_eq!(caller.app_instance_id, "nimi.overtone.local-developer");
        assert_eq!(caller.device_id, "local-developer-device");
        assert_eq!(
            caller.mode,
            runtime::generated::AccountCallerMode::LocalDeveloperApp as i32
        );
        assert!(caller.scopes.is_empty());
    }

    #[test]
    fn tester_consumes_shared_runtime_bridge_unary_codec_helpers() {
        let request = runtime::generated::GetAccountSessionStatusRequest { caller: None };
        let payload = runtime::build_unary_payload(
            runtime::RUNTIME_ACCOUNT_GET_ACCOUNT_SESSION_STATUS_METHOD_ID,
            request,
            Some(7_000),
        );
        assert_eq!(
            payload.method_id,
            runtime::RUNTIME_ACCOUNT_GET_ACCOUNT_SESSION_STATUS_METHOD_ID
        );
        assert_eq!(payload.timeout_ms, Some(7_000));
        assert_eq!(
            payload.request_bytes_base64.trim(),
            "",
            "protobuf default requests encode to an empty payload"
        );

        let result = runtime::RuntimeBridgeUnaryResult {
            response_bytes_base64: String::new(),
            response_metadata: None,
        };
        let decoded_response: runtime::generated::GetAccountSessionStatusResponse =
            runtime::decode_unary_result(
                runtime::RUNTIME_ACCOUNT_GET_ACCOUNT_SESSION_STATUS_METHOD_ID,
                &result,
            )
            .expect("decode response");
        assert_eq!(
            decoded_response.state,
            runtime::generated::AccountSessionState::Unspecified as i32
        );
    }

    #[test]
    fn tester_consumes_shared_nimi_data_directory_primitives() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time")
            .as_nanos();
        let data_root = std::env::temp_dir().join(format!("nimi-overtone-data-root-{unique}"));
        data::enforce_data_root_layout(&data_root).expect("enforce data root layout");

        for name in [
            "models",
            "dependencies",
            "environments",
            "apps",
            "cache",
            "tmp",
        ] {
            assert!(data_root.join(name).is_dir(), "{name} directory must exist");
        }

        std::fs::write(data_root.join("cache").join("probe.bin"), b"cache")
            .expect("write cache probe");
        let cache_plan =
            data::plan_directory_cleanup(&data_root, "cache").expect("cache cleanup plan");
        assert!(!cache_plan.requires_confirmation);
        let cache_outcome =
            data::execute_directory_cleanup(&data_root, "cache", None).expect("cache cleanup");
        assert_eq!(cache_outcome.removed_files, 1);
        assert!(data_root.join("cache").is_dir());

        std::fs::write(data_root.join("models").join("model.bin"), b"model")
            .expect("write model probe");
        let error = data::execute_directory_cleanup(
            &data_root,
            "models",
            Some(data::DESTRUCTIVE_CLEANUP_CONFIRMATION),
        )
        .expect_err("runtime-owned cleanup must fail closed");
        assert!(error.contains("Runtime"));
        assert!(data_root.join("models").join("model.bin").exists());
    }

    #[test]
    fn tester_consumes_shared_runtime_local_asset_helpers() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time")
            .as_nanos();
        let data_root = std::env::temp_dir().join(format!("nimi-overtone-model-root-{unique}"));
        let models_root = local_assets::runtime_models_dir(&data_root);
        std::fs::create_dir_all(&models_root).expect("create models root");
        let manifest = models_root.join(local_assets::ASSET_MANIFEST_FILE_NAME);
        std::fs::write(&manifest, "{}").expect("write manifest");

        let resolved = local_assets::canonical_asset_manifest_path(&manifest, &models_root)
            .expect("manifest under models root");
        assert_eq!(
            resolved,
            manifest.canonicalize().expect("canonical manifest")
        );

        let outside_dir = data_root.join("outside");
        std::fs::create_dir_all(&outside_dir).expect("create outside dir");
        let outside_manifest = outside_dir.join(local_assets::ASSET_MANIFEST_FILE_NAME);
        std::fs::write(&outside_manifest, "{}").expect("write outside manifest");
        let error = local_assets::canonical_asset_manifest_path(&outside_manifest, &models_root)
            .expect_err("outside manifest must fail closed");
        assert!(error.starts_with("LOCAL_AI_IMPORT_PATH_OUTSIDE_RUNTIME_ROOT"));

        let asset_dir = models_root.join("asset-1");
        std::fs::create_dir_all(&asset_dir).expect("create asset dir");
        assert_eq!(
            local_assets::reveal_target_for_asset(&models_root, "asset-1"),
            asset_dir
        );
        assert_eq!(
            local_assets::reveal_target_for_asset(&models_root, "../asset-1"),
            models_root
        );
    }
}
