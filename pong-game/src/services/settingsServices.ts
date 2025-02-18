import {GameConfig} from '../utils/config/gameConfig.js';

export class SettingsService {
    static loadSettings() {
        const ballSpeed = localStorage.getItem('ballSpeed') || GameConfig.DEFAULT_BALL_SPEED.toString();
        const paddleSpeed = localStorage.getItem('paddleSpeed') || GameConfig.DEFAULT_PADDLE_SPEED.toString();
        const paddleLength = localStorage.getItem('paddleLength') || GameConfig.DEFAULT_PADDLE_LENGTH.toString();
        const mapType = localStorage.getItem('mapType') || GameConfig.DEFAULT_MAP;
        const powerUpsEnabled = localStorage.getItem('powerUpsEnabled') === 'true';

        return {
            ballSpeed: parseInt(ballSpeed),
            paddleSpeed: parseInt(paddleSpeed),
            paddleLength: parseInt(paddleLength),
            mapType,
            powerUpsEnabled
        };
    }

    static saveSettings(settings: any) {
        localStorage.setItem('ballSpeed', settings.ballSpeed);
        localStorage.setItem('paddleSpeed', settings.paddleSpeed);
        localStorage.setItem('paddleLength', settings.paddleLength);
        localStorage.setItem('mapType', settings.mapType);
        localStorage.setItem('powerUpsEnabled', settings.powerUpsEnabled.toString());
    }
}
