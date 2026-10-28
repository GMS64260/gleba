/**
 * Charges d'exemple des serveurs de réseau, au format de leur documentation.
 * Identifiants manifestement fictifs (dépôt public : ni DevEUI réel, ni
 * préfixe de fabricant). À remplacer par les charges réelles du banc (lot 0
 * du plan), anonymisées.
 */

/** Instant de référence des tests : les dates des charges sont « récentes » par rapport à lui. */
export const MAINTENANT_FIXTURES = new Date("2026-10-23T10:30:00Z")

/** TTN v3, webhook « Uplink », Dragino LHT65N enregistré depuis le Device Repository. */
export const UPLINK_TTN_LHT65N = {
  end_device_ids: {
    device_id: "eui-00000000000c0de1",
    application_ids: { application_id: "ferme-essai" },
    dev_eui: "00000000000C0DE1",
    join_eui: "0000000000000001",
    dev_addr: "260B1234",
  },
  correlation_ids: ["gs:uplink:01HZZZZZZZZZZZZZZZZZZZZZZZ"],
  received_at: "2026-10-23T10:15:02.123456789Z",
  uplink_message: {
    session_key_id: "AYkAAAAAAAAAAAAAAAAAAA==",
    f_port: 2,
    f_cnt: 4321,
    frm_payload: "y7QI5AF/AX//f/8=",
    // Le décodeur Dragino rend certaines valeurs en texte (« 12.84 ») ;
    // TempC_DS = 327.67 est sa valeur « sonde externe absente ».
    decoded_payload: {
      BatV: 3.05,
      Bat_status: 3,
      Ext_sensor: "Temperature Sensor",
      Hum_SHT: "71.5",
      TempC_DS: 327.67,
      TempC_SHT: "12.84",
    },
    rx_metadata: [
      { gateway_ids: { gateway_id: "passerelle-a" }, rssi: -112, channel_rssi: -112, snr: -3.5 },
      { gateway_ids: { gateway_id: "passerelle-b" }, rssi: -97, channel_rssi: -97, snr: 6.25 },
    ],
    settings: { data_rate: { lora: { bandwidth: 125000, spreading_factor: 9 } }, frequency: "868100000" },
    received_at: "2026-10-23T10:15:02.012345678Z",
    consumed_airtime: "0.205824s",
    version_ids: { brand_id: "dragino", model_id: "lht65n", firmware_version: "1.8", band_id: "EU_863_870" },
  },
}

/** TTN v3, événement de jonction (pas de mesure). */
export const JOIN_TTN = {
  end_device_ids: { device_id: "eui-00000000000c0de1", dev_eui: "00000000000C0DE1" },
  received_at: "2026-10-23T10:14:00Z",
  join_accept: { session_key_id: "AYkAAAAAAAAAAAAAAAAAAA==", received_at: "2026-10-23T10:14:00Z" },
}

/**
 * ChirpStack v4, intégration HTTP JSON, `?event=up`, sonde de sol Milesight
 * EM500-SMTC. Le nom du profil d'appareil est un libellé libre saisi dans
 * ChirpStack : il ne désigne aucun profil de décodage Gleba.
 */
export const UP_CHIRPSTACK_EM500 = {
  deduplicationId: "3ac7e3c4-4401-4b8d-9386-a5c902f9202d",
  time: "2026-10-23T10:20:00.000000+00:00",
  deviceInfo: {
    tenantId: "52f14cd4-c6f1-4fbd-8f87-4025e1d49242",
    tenantName: "Ferme",
    applicationId: "6a5f2a4c-0f0b-4c8e-9b8e-2a3f8f0e7a11",
    applicationName: "capteurs",
    deviceProfileId: "0f8c7f8e-6a3b-4c1e-8d2f-4b5a6c7d8e9f",
    deviceProfileName: "Sondes de sol",
    deviceName: "sonde-planche-3",
    devEui: "00000000000050a1",
    tags: {},
  },
  devAddr: "00a1b2c3",
  adr: true,
  dr: 5,
  fCnt: 77,
  fPort: 85,
  confirmed: false,
  data: "AXVkA2cEAQ==",
  object: { battery: 98, temperature: 14.2, moisture: 31.5, conductivity: 412 },
  rxInfo: [{ gatewayId: "0016c001ff10abcd", uplinkId: 1234, rssi: -88, snr: 9 }],
  txInfo: { frequency: 868300000 },
}

/** ChirpStack v4, `?event=status` : batterie remontée par le serveur de réseau. */
export const STATUS_CHIRPSTACK = {
  deduplicationId: "9b1f0e2a-1d3c-4e5f-8a7b-6c5d4e3f2a1b",
  time: "2026-10-23T10:25:00+00:00",
  deviceInfo: { devEui: "00000000000050a1", deviceProfileName: "Sondes de sol" },
  margin: 7,
  externalPowerSource: false,
  batteryLevelUnavailable: false,
  batteryLevel: 87.5,
}
