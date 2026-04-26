#!/bin/bash
########################################################################
#              author:    Anum Hosen                                   #
#              email:     anumhosen@gmail.com                          #
#----------------------------------------------------------------------#
#                         Dept. of Physics                             #
#           Jashore University of Science and Technology               #
########################################################################
set -e
source /usr/local/gromacs/bin/GMXRC

# Initial equilibration step
gmx grompp -f step6.1_equilibration.mdp \
	   -o step6.1_equilibration.tpr \
	   -c step6.0_minimization.gro \
	   -r step5_input.gro \
	   -p topol.top \
	   -n index.ndx
	   
gmx mdrun -v -deffnm step6.1_equilibration \
          -ntmpi 1 \
          -ntomp 16 \
          -nb gpu \
          -pme gpu \
          -update gpu \
          -pin on

# Equilibration Steps (step6.2 to step6.6)
for i in {2..6}; do
  prev=$((i-1))
  gmx grompp -f step6.${i}_equilibration.mdp \
             -o step6.${i}_equilibration.tpr \
             -c step6.${prev}_equilibration.gro \
             -r step5_input.gro \
             -p topol.top \
             -n index.ndx

  gmx mdrun -v -deffnm step6.${i}_equilibration \
            -ntmpi 1 \
            -ntomp 16 \
            -nb gpu \
            -pme gpu \
            -update gpu \
            -pin on
done
