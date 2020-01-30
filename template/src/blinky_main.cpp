/*
 * main.cpp
 *
 * Template Author: LeeChunHei
 *
 */

#include "system/system.h"

#include "system/systick.h"
#include "device_driver/led.h"

int main() {

	System::InitSystem();

	DeviceDriver::Led::Config led_config;
	led_config.id = 0;
	led_config.is_enable = true;
	led_config.is_active_low = true;
	DeviceDriver::Led led(led_config);

	while(1){
		System::Systick::DelayMS(500);
		led.Toggle();
	}
}
