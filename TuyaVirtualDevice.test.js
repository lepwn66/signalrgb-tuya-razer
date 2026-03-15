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
        // Grid: 22 wide x 11 tall
        // 40 LEDs: 10 left + 20 top + 10 right
        // Placed at consecutive integer coordinates so they tile with no gaps.
        //
        // Left column: x=0, y=10 down to y=1  (10 LEDs)
        // Top row:     y=0, x=1 through x=20  (20 LEDs)
        // Right column: x=21, y=1 up to y=10  (10 LEDs)

        const positions = [];

        // Left column (10 LEDs): bottom to top at x=0
        for (let i = 0; i < 10; i++)
        {
            positions.push([0, 10 - i]);
        }

        // Top row (20 LEDs): left to right at y=0
        for (let i = 0; i < 20; i++)
        {
            positions.push([1 + i, 0]);
        }

        // Right column (10 LEDs): top to bottom at x=21
        for (let i = 0; i < 10; i++)
        {
            positions.push([21, 1 + i]);
        }

        return positions;
    }

    setupDevice(tuyaDevice)
    {
        this.tuyaLeds = DeviceList[tuyaDevice.deviceType].leds;
        this.ledCount = 40; // 40 addressable segments

        this.ledNames = this.getLedNames();
        this.ledPositions = this.getLedPositions();

        device.setName(tuyaDevice.getName());

        device.setSize([22, 11]); // grid sized to exactly fit the U-shape with no gaps
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
