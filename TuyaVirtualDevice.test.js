import BaseClass from './Libs/BaseClass.test.js';
import DeviceList from './Data/DeviceList.test.js';
import TuyaDevice from './TuyaDevice.test.js';
import { Hex } from './Crypto/Hex.test.js';

export default class TuyaVirtualDevice extends BaseClass
{
    constructor(deviceData)
    {
        super();
        // Initialize tuya device from saved data
        this.tuyaDevice = new TuyaDevice(deviceData, null);
        this.frameDelay = 50;
        this.lastRender = 0;

        this.setupDevice(this.tuyaDevice);
    }
    
    getLedNames()
    {
        let ledNames = [];
        for (let i = 1; i <= this.ledCount; i++)
        {
            ledNames.push(`Led ${i}`);
        }
        return ledNames;
    }

    getLedPositions()
    {
        // High-res grid: 20 wide x 10 tall
        // 12 LEDs in 4 quarters of 3:
        //   Q1: Left column   (3 LEDs) - bottom, mid, top-left corner
        //   Q2: Top-left half (3 LEDs) - evenly across left half of top
        //   Q3: Top-right half(3 LEDs) - evenly across right half of top
        //   Q4: Right column  (3 LEDs) - top-right corner, mid, bottom

        const W = 19;
        const H = 9;

        return [
            // Q1: Left column - bottom to top
            [0, H],                          // bottom-left
            [0, Math.round(H / 2)],          // mid-left
            [0, 0],                          // top-left corner

            // Q2: Top-left half
            [Math.round(W / 6), 0],          // ~3
            [Math.round(W * 2/6), 0],        // ~6
            [Math.round(W * 3/6), 0],        // ~10 (midpoint)

            // Q3: Top-right half
            [Math.round(W * 4/6), 0],        // ~13
            [Math.round(W * 5/6), 0],        // ~16
            [W, 0],                          // top-right corner

            // Q4: Right column - top to bottom
            [W, Math.round(H / 3)],          // upper-right
            [W, Math.round(H * 2/3)],        // lower-right
            [W, H],                          // bottom-right
        ];
    }

    setupDevice(tuyaDevice)
    {
        this.tuyaLeds = DeviceList[tuyaDevice.deviceType].leds;
        this.ledCount = 12;

        this.ledNames = this.getLedNames();
        this.ledPositions = this.getLedPositions();

        device.setName(tuyaDevice.getName());

        device.setSize([20, 10]); // high-res grid for precise sampling
        device.setControllableLeds(this.ledNames, this.ledPositions);
    }

    render(lightingMode, forcedColor, now)
    {
        if (now - this.lastRender > this.frameDelay)
        {
            this.lastRender = now;
            let RGBData = [];
            switch(lightingMode)
            {
                case "Canvas":
                    RGBData = this.getDeviceRGB();
                    break;
                case "Forced":
                    for (let i = 0; i < this.ledCount; i++)
                    {
                        RGBData.push(this.hexToRGB(forcedColor));
                    }
                    break;
            }

            let colorString = this.generateColorString(RGBData);
            this.tuyaDevice.sendColors(colorString);
        }
    }

    getDeviceRGB()
    {
        const RGBData = [];
    
        for(let i = 0 ; i < this.ledPositions.length; i++){
            const ledPosition = this.ledPositions[i];
            const color = device.color(ledPosition[0], ledPosition[1]);
            RGBData.push(color);
        }
    
        return RGBData;
    }

    generateColorString(colors)
    {
        const numLeds = colors.length;

        if (numLeds === 1)
        {
            const [h1,s1,v1] = this.rgbToHsv(colors[0]);
            let color = this.getW32FromHex(h1.toString(16), 2).toString(Hex) +
                        this.getW32FromHex(parseInt(s1 / 10).toString(16), 1).toString(Hex) +
                        this.getW32FromHex(parseInt(v1 / 10).toString(16), 1).toString(Hex);

            return color + "00000100";
        } else
        {
            let colorArray = [];

            for (let color of colors)
            {
                const [h,s,v] = this.rgbToHsv(color);
                colorArray.push(
                    this.getW32FromHex(h.toString(16), 2).toString(Hex) +
                    this.getW32FromHex(s.toString(16), 2).toString(Hex) +
                    this.getW32FromHex(v.toString(16), 2).toString(Hex)
                );
            }

            // Each LED gets its own unique segment tag
            let colorString = '';
            for (let i = 1; i <= numLeds; i++)
            {
                colorString += this.getW32FromHex(i.toString(16), 1).toString(Hex);
            }

            let countHex = this.getW32FromHex(numLeds.toString(16), 2).toString(Hex);
            let spliceNumHex = this.getW32FromHex(numLeds.toString(16), 2).toString(Hex);
            let colorValue = countHex + colorArray.join('') + spliceNumHex + colorString;

            return colorValue;
        }
    }
}
