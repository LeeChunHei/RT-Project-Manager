SRC_PATH=src
OUT_PATH=debug
OUT_OBJ_PATH=$(OUT_PATH)/$(SRC_PATH)
PROJ_NAME=%s
CONFIG=%s
XIP_MACRO=%s
LIB_PATH=%s
LIB_PATH_SRC=$(LIB_PATH)/src
LIB_PATH_INC=$(LIB_PATH)/inc
LIB_PATH_CONFIG=$(LIB_PATH)/config
OP_FLAG=%s
DEBUG_FLAG=%s
LINKER_SCRIPT=%s
TOOLCHAIN_FLAGS= -mcpu=cortex-m7 -march=armv7e-m -mthumb -mthumb-interwork -mfloat-abi=hard -mfpu=fpv5-d16 $(OP_FLAG) -fmessage-length=0 -fsigned-char -ffunction-sections -fdata-sections -fno-move-loop-invariants -Wall -Wextra  $(DEBUG_FLAG)
ASM_FLAGS=-x assembler-with-cpp -DDEBUG -D$(CONFIG) -DRT1052 $(XIP_MACRO) -I"./inc" -I"$(LIB_PATH_CONFIG)" -I"$(LIB_PATH_INC)"
C_FLAGS=-DDEBUG -D$(CONFIG) -DRT1052 $(XIP_MACRO) -I"./inc" -I"$(LIB_PATH_CONFIG)" -I"$(LIB_PATH_INC)" -std=gnu11
CPP_FLAGS=-DDEBUG -D$(CONFIG) -DRT1052 $(XIP_MACRO) -I"./inc" -I"$(LIB_PATH_CONFIG)" -I"$(LIB_PATH_INC)" -std=gnu++11 -fabi-version=0 -fno-exceptions -fno-rtti -fno-use-cxa-atexit -fno-threadsafe-statics
LINK_FLAGS=-T build/$(LINKER_SCRIPT).ld -Xlinker --gc-sections -Xlinker -print-memory-usage -Wl,-Map,"$(OUT_PATH)/$(PROJ_NAME).map" --specs=nano.specs -u _printf_float --specs=rdimon.specs
TOOLCHAIN_LOC=%s

rwildcard=$(wildcard $1/$2) $(foreach d,$(wildcard $1/*),$(call rwildcard,$(d),$2))
SRC_FILES:=$(call rwildcard,$(SRC_PATH),*.c)
SRC_FILES:=$(SRC_FILES) $(call rwildcard,$(SRC_PATH),*.S)
SRC_FILES:=$(SRC_FILES) $(call rwildcard,$(SRC_PATH),*.cpp)
SRC_FILES:=$(SRC_FILES) $(call rwildcard,$(LIB_PATH_SRC),*.c)
SRC_FILES:=$(SRC_FILES) $(call rwildcard,$(LIB_PATH_SRC),*.S)
SRC_FILES:=$(SRC_FILES) $(call rwildcard,$(LIB_PATH_SRC),*.cpp)

OBJ_FILES:=$(SRC_FILES:$(SRC_PATH)/%.c=$(OUT_OBJ_PATH)/%.o)
OBJ_FILES:=$(OBJ_FILES:$(SRC_PATH)/%.S=$(OUT_OBJ_PATH)/%.o)
OBJ_FILES:=$(OBJ_FILES:$(SRC_PATH)/%.cpp=$(OUT_OBJ_PATH)/%.o)
OBJ_FILES:=$(OBJ_FILES:$(LIB_PATH_SRC)/%.c=$(OUT_OBJ_PATH)/%.o)
OBJ_FILES:=$(OBJ_FILES:$(LIB_PATH_SRC)/%.S=$(OUT_OBJ_PATH)/%.o)
OBJ_FILES:=$(OBJ_FILES:$(LIB_PATH_SRC)/%.cpp=$(OUT_OBJ_PATH)/%.o)
OBJ_DEP:=$(OBJ_FILES:.o=.d)
-include $(OBJ_DEP)

DIR_MADE:=$(sort $(call rwildcard,$(OUT_OBJ_PATH),*)) dummy
DIR_MADE:=$(subst $() $(),$()/ $(),$(DIR_MADE))
OUT_DIRS:=$(sort $(dir $(OBJ_FILES)))
OUT_DIRS:=$(sort $(OUT_DIRS) $(sort $(dir $(LIB_OBJ_FILES))))
ifeq ($(OS),Windows_NT)
$(foreach dir, $(OUT_DIRS), $(if $(findstring $(dir),$(DIR_MADE)),,$(shell mkdir $(subst /,\,$(dir)))))
else
$(foreach dir, $(OUT_DIRS), $(if $(findstring $(dir),$(DIR_MADE)),,$(shell mkdir -p $(dir))))
endif

all: $(OUT_PATH)/$(PROJ_NAME).elf

clean:
	$(info Cleaning $(<))
ifeq ($(OS),Windows_NT)
	@rmdir /s /q $(OUT_PATH)
else
	@rm -rf $(OUT_PATH)
endif
	$(info Finish Cleaning $(<))

$(OUT_PATH)/$(PROJ_NAME).elf: $(OBJ_FILES)
	$(info Linking Objects $(<))
	@$(TOOLCHAIN_LOC)arm-none-eabi-g++ $(TOOLCHAIN_FLAGS) $(LINK_FLAGS) -o "$@" $(OBJ_FILES) $(LIB_PATH_SRC)/system/cmsis/libarm_cortexM7lfdp_math.a

$(OUT_OBJ_PATH)/%.o: $(SRC_PATH)/%.c
	$(info Compiling $(<))
	@$(TOOLCHAIN_LOC)arm-none-eabi-gcc $(TOOLCHAIN_FLAGS) $(C_FLAGS) -MMD -MP -MF"$(@:%.o=%.d)" -MT"$(@)" -c -o "$@" "$<"
$(OUT_OBJ_PATH)/%.o: $(SRC_PATH)/%.S
	$(info Compiling $(<))
	@$(TOOLCHAIN_LOC)arm-none-eabi-gcc $(TOOLCHAIN_FLAGS) $(ASM_FLAGS) -MMD -MP -MF"$(@:%.o=%.d)" -MT"$(@)" -c -o "$@" "$<"
$(OUT_OBJ_PATH)/%.o: $(SRC_PATH)/%.cpp
	$(info Compiling $(<))
	@$(TOOLCHAIN_LOC)arm-none-eabi-g++ $(TOOLCHAIN_FLAGS) $(CPP_FLAGS) -MMD -MP -MF"$(@:%.o=%.d)" -MT"$(@)" -c -o $@ $<
$(OUT_OBJ_PATH)/%.o: $(LIB_PATH_SRC)/%.c
	$(info Compiling $(<))
	@$(TOOLCHAIN_LOC)arm-none-eabi-gcc $(TOOLCHAIN_FLAGS) $(C_FLAGS) -MMD -MP -MF"$(@:%.o=%.d)" -MT"$(@)" -c -o "$@" "$<"
$(OUT_OBJ_PATH)/%.o: $(LIB_PATH_SRC)/%.S
	$(info Compiling $(<))
	@$(TOOLCHAIN_LOC)arm-none-eabi-gcc $(TOOLCHAIN_FLAGS) $(ASM_FLAGS) -MMD -MP -MF"$(@:%.o=%.d)" -MT"$(@)" -c -o "$@" "$<"
$(OUT_OBJ_PATH)/%.o: $(LIB_PATH_SRC)/%.cpp
	$(info Compiling $(<))
	@$(TOOLCHAIN_LOC)arm-none-eabi-g++ $(TOOLCHAIN_FLAGS) $(CPP_FLAGS) -MMD -MP -MF"$(@:%.o=%.d)" -MT"$(@)" -c -o $@ $<